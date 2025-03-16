interface ExpectedProps {
  variant: "primary" | "secondary";
}

const Alert = React.forwardRef<
  HTMLInputElement,
  React.HTMLAttributes<HTMLInputElement> & ExpectedProps
>(({ className, variant, ...props }, ref) => <input ref={ref} />);
