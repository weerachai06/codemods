import {
  FileInfo,
  API,
  ObjectPattern,
  TSTypeParameterInstantiation,
} from "jscodeshift";
import prettier from "prettier";
import type * as namedType from "jscodeshift";

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

function createPropsTypeIntersection(
  j: namedType.JSCodeshift,
  path: namedType.ASTPath<namedType.CallExpression>,
) {
  const typeParameters = // @ts-ignore
    path.node.typeParameters as TSTypeParameterInstantiation;
  if (!typeParameters?.params[1]) return null;

  // Handle HTMLAttributes with generic type
  function createHTMLAttributesType(elementType: string) {
    return j.tsTypeReference(
      j.tsQualifiedName(j.identifier("React"), j.identifier("HTMLAttributes")),
      j.tsTypeParameterInstantiation([
        j.tsTypeReference(j.identifier(elementType)),
      ]),
    );
  }

  const propsType = typeParameters.params[1];
  if (propsType.type === "TSIntersectionType") {
    const typeMapping = propsType.types
      .map((type) => {
        if (type.type === "TSTypeReference") {
          if (type.typeName.type === "TSQualifiedName") {
            // Handle React.HTMLAttributes<T>
            const elementType = type.typeParameters?.params[0];
            if (
              type.typeName.right.type === "Identifier" &&
              type.typeName.right.name === "HTMLAttributes" &&
              elementType?.type === "TSTypeReference"
            ) {
              // @ts-ignore
              return createHTMLAttributesType(elementType.typeName.name);
            }
          }

          return j.tsTypeReference(type.typeName);
        }
        return undefined;
      })
      .filter((data): data is NonNullable<typeof data> => Boolean(data));

    return j.tsIntersectionType([
      ...typeMapping,
      j.tsTypeReference(j.identifier("RefProps")),
    ]);
  }

  if (propsType.type === "TSTypeReference") {
    return j.tsIntersectionType([
      j.tsTypeReference(propsType.typeName),
      j.tsTypeReference(j.identifier("RefProps")),
    ]);
  }

  return null;
}

export default async function transformer(file: FileInfo, api: API) {
  const j = api.jscodeshift;
  const root = j(file.source);

  // Find element type from forwardRef generic first
  const forwardRefType = getFirstOfGenericForwardRefType(file, api);

  // Create RefProps interface
  const refPropsInterface = createRefPropsInterface(j, forwardRefType);

  // Find the first interface and insert RefProps before it
  const firstInterface = root.find(j.TSInterfaceDeclaration).at(0).paths()[0];
  if (firstInterface) {
    j(firstInterface).insertBefore(refPropsInterface);
  }

  // Transform forwardRef to regular function component
  root
    .find(j.CallExpression, {
      callee: {
        type: "MemberExpression",
        property: { name: "forwardRef" },
      },
    })
    .forEach((path) => {
      const combinedPropsType = createPropsTypeIntersection(j, path);

      if (combinedPropsType) {
        // @ts-ignore
        const [propsParam] = path.node.arguments[0].params;

        if (propsParam.type === "ObjectPattern" && combinedPropsType) {
          propsParam.typeAnnotation = combinedPropsType;
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
      if (combinedPropsType)
        paramWithType.typeAnnotation = j.tsTypeAnnotation(combinedPropsType);

      const newFunction = j.arrowFunctionExpression(
        [paramWithType],
        arrowFunction.body,
      );

      j(path).replaceWith(newFunction);
    });

  // Get transformed source without modifying imports/exports
  const transformed = root.toSource({
    quote: "double",
    trailingComma: true,
    arrayBracketSpacing: true,
    objectCurlySpacing: true,
  });

  // Use Prettier but preserve original formatting
  const options = await prettier.resolveConfig(file.path);
  return prettier.format(transformed, {
    ...options,
    parser: "typescript",
  });
}
