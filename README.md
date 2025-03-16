# Codemods Documentation

This repository contains codemods for transforming React components, specifically focusing on converting `React.forwardRef` components to use ref props.

## Installation

```bash
npm install
```

## Available Scripts

### Testing

```bash
# Run tests
npm test

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Building

```bash
# Build the project
npm run build

# Watch mode for development
npm run build:watch
```

### Transformation Scripts

```bash
# Transform files
npm run transform -- <path-to-transform-script> <path-to-files>

# Dry run (preview changes)
npm run transform:dry -- <path-to-transform-script> <path-to-files>

# Transform and print output
npm run transform:print -- <path-to-transform-script> <path-to-files>
```

## Example Usage

Transform a single file:
```bash
npm run transform:dry ./dist/transform/forward-ref-to-ref-prop.js ./src/components/MyComponent.tsx
```

Transform multiple files:
```bash
npm run transform:dry ./dist/transform/forward-ref-to-ref-prop.js './src/**/*.tsx'
```

## NPX Usage

Run directly with npx:

```bash
npx @weerachai06/react-codemod './src/**/*.tsx'
```

Or install globally:

```bash
npm install -g @weerachai06/react-codemod
react-codemod './src/**/*.tsx'
```

## Transforms

### forward-ref-to-ref-prop

Converts React.forwardRef components to use ref props:

```typescript
// Before
const Component = React.forwardRef<HTMLInputElement, Props>((props, ref) => {
  return <input ref={ref} {...props} />;
});

// After
const Component = ({ 
  ref,
  ...props 
}: Props & React.HTMLAttributes<HTMLInputElement> & RefProps) => {
  return <input ref={ref} {...props} />;
};
```

For detailed documentation on each transform, see the respective files in the transform directory.

Let me know if you need any clarification or have questions about specific transforms!