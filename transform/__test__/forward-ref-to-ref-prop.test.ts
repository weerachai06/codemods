import { defineTest } from "jscodeshift/src/testUtils";
jest.autoMockOff();

// The name of the transformer
const name = "forward-ref-to-ref-prop";

// The fixtures to test
const fixtures = ["ref", "intersection-type", "no-spread-props"] as const;

describe(name, () => {
  fixtures.forEach((test) =>
    defineTest(__dirname, name, { parser: "tsx" }, `${name}/${test}`, {
      parser: "tsx",
    }),
  );
});
