import React from "react";

interface ExpectedProps {
  variant: "primary" | "secondary";
}

const Alert = React.forwardRef<
  HTMLInputElement,
  React.HTMLAttributes<HTMLInputElement> & ExpectedProps
>((props, ref) => {
  const { className, variant } = props;
  return <input ref={ref} className={className} />;
});

export default Alert;
