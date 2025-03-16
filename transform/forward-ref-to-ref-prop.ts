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
        }
      }
    });

  return elementType;
}

function getPropsDeclarationInterface(file: FileInfo, api: API) {
  const j = api.jscodeshift;
  const root = j(file.source);
  let propsInterface: string | undefined = undefined;

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
          .params[1] as unknown as TSTypeReferenceNode;

        if (
          refType.type === "TSTypeReference" &&
          refType.typeName.type === "Identifier"
        ) {
          propsInterface = refType.typeName.name;
        } else if (refType.type === "TSIntersectionType") {
          propsInterface = undefined;
        }
      }
    });

  return propsInterface;
}

function updatePropsInterface(
  file: FileInfo,
  api: API,
  propsInterface: string,
) {
  const j = api.jscodeshift;
  const root = j(file.source);

  root
    .find(j.TSInterfaceDeclaration, {
      id: { name: propsInterface },
    })
    .forEach((path) => {
      path.node.body.body.push(
        j.tsPropertySignature(
          j.identifier("ref"),
          j.tsTypeAnnotation(
            j.tsTypeReference(
              j.tsQualifiedName(
                j.identifier("React"),
                j.identifier("RefObject"),
              ),
              j.tsTypeParameterInstantiation([
                j.tsTypeReference(j.identifier("HTMLInputElement")),
              ]),
            ),
          ),
        ),
      );
    });
}

export default async function transformer(file: FileInfo, api: API) {
  const j = api.jscodeshift;
  const root = j(file.source);

  // Find element type from forwardRef generic
  const forwardRefType = getFirstOfGenericForwardRefType(file, api);

  const propsInterface = getPropsDeclarationInterface(file, api);

  // If it's intersection type, skip the transformation
  if (!propsInterface) {
    log(
      "Skipping transformation because props interface is an intersection type",
    );
    return file.source;
  }

  // Update the interface to include ref prop with found element type
  root
    .find(j.TSInterfaceDeclaration, {
      id: { name: propsInterface },
    })
    .forEach((path) => {
      path.node.body.body.push(
        j.tsPropertySignature(
          j.identifier("ref"),
          j.tsTypeAnnotation(
            j.tsTypeReference(
              j.tsQualifiedName(
                j.identifier("React"),
                j.identifier("RefObject"),
              ),
              j.tsTypeParameterInstantiation([
                j.tsTypeReference(j.identifier(forwardRefType)),
              ]),
            ),
          ),
        ),
      );
    });

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
      const arrowFunction = path.node.arguments[0];
      if (arrowFunction.type !== "ArrowFunctionExpression") return;

      // Get props from the first parameter if it's an object pattern
      const [propsParam] = arrowFunction.params;
      let propProperties: ObjectPattern["properties"] = [];

      if (propsParam.type === "ObjectPattern") {
        propProperties = propsParam.properties;
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
              propProperties = declarator.node.id.properties;
            }
          });
      }

      // Create new function with received parameters
      const paramWithType = j.objectPattern([
        ...propProperties,
        j.property("init", j.identifier("ref"), j.identifier("ref")),
      ]);

      // Add type annotation to the object pattern
      paramWithType.typeAnnotation = j.tsTypeAnnotation(
        j.tsTypeReference(j.identifier(propsInterface)),
      );

      const newFunction = j.arrowFunctionExpression(
        [paramWithType],
        arrowFunction.body,
      );

      j(path).replaceWith(newFunction);
    });

  // Update useForkRef call to use ref prop
  // root
  //   .find(j.CallExpression, {
  //     callee: { name: "useForkRef" }
  //   })
  //   .forEach((path) => {
  //     if (path.node.arguments.length === 2) {
  //       const [firstArg, secondArg] = path.node.arguments;
  //       if (secondArg.type === "Identifier" && secondArg.name === "ref") {
  //         j(path).replaceWith(j.identifier("ref"));
  //       }
  //     }
  //   });

  // Get transformed source
  const transformed = root.toSource({ parser: "tsx" });

  // Use synchronous Prettier formatting
  const options = await prettier.resolveConfig(process.cwd());

  return prettier.format(transformed, {
    ...options,
    parser: "typescript",
  });
}
