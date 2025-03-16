import {
  FileInfo,
  API,
  ObjectPattern,
  TSTypeParameterInstantiation,
} from "jscodeshift";
import prettier from "prettier";
import type * as namedType from "jscodeshift";
import { log } from "../helpers/logger";

// Add type definitions
type TypeName = namedType.Identifier | namedType.TSQualifiedName;

type TSTypeReferenceNode =
  | {
      typeName: TypeName;
      typeParameters?: TSTypeParameterInstantiation;
      type: "TSTypeReference";
    }
  | namedType.TSIntersectionType;

/**
 * Extracts the first generic type parameter from React.forwardRef usage in a file.
 * This function specifically looks for the element type in forwardRef's type parameters.
 *
 * @param file - The file information object containing the source code
 * @param api - The jscodeshift API object
 * @returns The name of the element type found in forwardRef's type parameters, defaults to "HTMLElement" if none found
 *
 * @example
 * // For code like: React.forwardRef<HTMLDivElement, Props>((props, ref) => {...})
 * // This would return "HTMLDivElement"
 */
function getFirstOfGenericForwardRefType(file: FileInfo, api: API): string {
  const j = api.jscodeshift;
  const root = j(file.source);
  let elementType = "HTMLElement"; // default fallback

  root
    .find(j.CallExpression, {
      callee: {
        type: "MemberExpression",
        // object: { name: "React" },
        property: { name: "forwardRef" },
      },
    })
    .forEach((path) => {
      if ("typeParameters" in path.node) {
        const typeParameters = path.node
          .typeParameters as namedType.TypeParameterInstantiation;
        const refType = typeParameters
          .params[0] as unknown as TSTypeReferenceNode;
        if (
          refType.type === "TSTypeReference" &&
          refType.typeName.type === "Identifier"
        ) {
          elementType = refType.typeName.name;
        } else if (
          refType.type === "TSTypeReference" &&
          refType.typeName.type === "TSQualifiedName"
        ) {
          // @ts-ignore
          elementType = refType.typeName.qualification.name;
        }
      }
    });

  return elementType;
}

function getPropsDeclarationInterface(file: FileInfo, api: API) {
  const j = api.jscodeshift;
  const root = j(file.source);
  let propsInterface: string | undefined = "Props";

  root
    .find(j.CallExpression, {
      callee: {
        type: "MemberExpression",
        property: { name: "forwardRef" },
      },
    })
    .forEach((path) => {
      if ("typeParameters" in path.node) {
        const typeParameters = path.node
          .typeParameters as namedType.TypeParameterInstantiation;
        const refType = typeParameters
          .params[1] as unknown as TSTypeReferenceNode;

        if (refType.type === "TSIntersectionType") {
        } else if (
          refType.type === "TSTypeReference" &&
          refType.typeName.type === "Identifier"
        ) {
          propsInterface = refType.typeName.name;
        }
      }
    });

  return propsInterface;
}

function updatePropsType(path: any, j: any, propsInterface: string) {
  // Create intersection type annotation
  const typeAnnotation = j.tsTypeAnnotation(
    j.tsIntersectionType([
      j.tsTypeReference(j.identifier(propsInterface)),
      j.tsTypeReference(j.identifier("RefProps")),
    ]),
  );

  return typeAnnotation;
}

function reorderProperties(properties: ObjectPattern["properties"]) {
  // Separate spread elements from other properties
  const spreadProps = properties.filter(
    (prop) => (prop.type as "RestElement") === "RestElement",
  );
  const regularProps = properties.filter(
    (prop) => (prop.type as "RestElement") !== "RestElement",
  );

  // Return combined array with spread last
  return [...regularProps, ...spreadProps];
}

function createRefPropsInterface(j: any, elementType: string) {
  return j.tsInterfaceDeclaration(
    j.identifier("RefProps"),
    j.tsInterfaceBody([
      j.tsPropertySignature(
        j.identifier("ref"),
        j.tsTypeAnnotation(
          j.tsTypeReference(
            j.tsQualifiedName(j.identifier("React"), j.identifier("RefObject")),
            j.tsTypeParameterInstantiation([
              j.tsTypeReference(j.identifier(elementType)),
            ]),
          ),
        ),
      ),
    ]),
  );
}

function handleIntersectionType(path: any, j: any, forwardRefType: string) {
  const typeParameters = path.node.typeParameters;
  if (!typeParameters?.params[1]) return null;

  const propsType = typeParameters.params[1];
  if (propsType.type !== "TSIntersectionType") return null;

  // Create RefProps interface
  const refPropsInterface = createRefPropsInterface(j, forwardRefType);

  // Create new intersection type without modifying original props
  const newTypeAnnotation = j.tsTypeAnnotation(
    j.tsIntersectionType([
      ...propsType.types,
      j.tsTypeReference(j.identifier("RefProps")),
    ]),
  );

  return {
    refPropsInterface,
    typeAnnotation: newTypeAnnotation,
  };
}

export default async function transformer(file: FileInfo, api: API) {
  const j = api.jscodeshift;
  const root = j(file.source);

  // Find element type from forwardRef generic first
  const forwardRefType = getFirstOfGenericForwardRefType(file, api);

  // Find the last import declaration
  const lastImport = root.find(j.ImportDeclaration).at(-1).paths()[0];

  if (lastImport) {
    // Insert RefProps interface after the last import
    const refPropsInterface = createRefPropsInterface(j, forwardRefType);
    j(lastImport).insertAfter(refPropsInterface);
  } else {
    // If no imports found, insert at the beginning of the file
    root.find(j.Program).forEach((path) => {
      const refPropsInterface = createRefPropsInterface(j, forwardRefType);
      path.node.body.unshift(refPropsInterface);
    });
  }

  const propsInterface = getPropsDeclarationInterface(file, api);
  // If it's intersection type, skip the transformation
  if (!propsInterface) {
    log(
      "Skipping transformation because props interface is an intersection type",
    );
    return file.source;
  }

  // Transform forwardRef to regular function component
  root
    .find(j.CallExpression, {
      callee: {
        type: "MemberExpression",
        object: { name: "React" },
        property: { name: "forwardRef" },
      },
    })
    .forEach((path) => {
      const intersectionResult = handleIntersectionType(
        path,
        j,
        forwardRefType,
      );

      if (intersectionResult) {
        // Add RefProps interface after imports
        const lastImport = root.find(j.ImportDeclaration).at(-1).paths()[0];
        if (lastImport) {
          j(lastImport).insertAfter(intersectionResult.refPropsInterface);
        }

        // Update function parameter type
        // @ts-ignore
        const [propsParam] = path.node.arguments[0].params;
        if (propsParam.type === "ObjectPattern") {
          propsParam.typeAnnotation = intersectionResult.typeAnnotation;
        }
      }

      const arrowFunction = path.node.arguments[0];
      if (arrowFunction.type !== "ArrowFunctionExpression") return;

      // Get props from the first parameter
      const [propsParam] = arrowFunction.params;
      let propProperties: ObjectPattern["properties"] = [];

      if (propsParam.type === "ObjectPattern") {
        // Reorder properties to ensure spread is last
        propProperties = reorderProperties(propsParam.properties);
      } else if (
        propsParam.type === "Identifier" &&
        propsParam.name === "props"
      ) {
        // Find props destructuring in the function body
        j(arrowFunction.body)
          .find(j.VariableDeclarator)
          .forEach((declarator) => {
            if (
              declarator.node.id.type === "ObjectPattern" &&
              declarator.node.init?.type === "Identifier" &&
              declarator.node.init?.name === "props"
            ) {
              propProperties = reorderProperties(declarator.node.id.properties);
            }
          });
      }

      const restProperties = propProperties.filter(
        (prop) => (prop.type as "RestElement") === "RestElement",
      );
      // Create new function parameters with ref and ordered props
      const paramWithType = j.objectPattern([
        j.property("init", j.identifier("ref"), j.identifier("ref")),
        ...propProperties.filter(
          (prop) => (prop.type as "RestElement") !== "RestElement",
        ),
        ...restProperties,
      ]);

      // Add intersection type annotation
      paramWithType.typeAnnotation = updatePropsType(path, j, propsInterface);

      const newFunction = j.arrowFunctionExpression(
        [paramWithType],
        arrowFunction.body,
      );

      j(path).replaceWith(newFunction);
    });

  // Get transformed source
  const transformed = root.toSource({ parser: "tsx" });

  // Use synchronous Prettier formatting
  const options = await prettier.resolveConfig(process.cwd());

  return prettier.format(transformed, {
    ...options,
    parser: "typescript",
  });
}
