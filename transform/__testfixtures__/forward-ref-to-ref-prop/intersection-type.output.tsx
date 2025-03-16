import React from "react";

interface RefProps {
  ref: React.RefObject<HTMLInputElement>;
}

interface ExpectedProps {
  variant: "primary" | "secondary";
}

const Alert = ({
  ref: ref,
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLInputElement> & ExpectedProps & RefProps) => (
  <input ref={ref} />
);

export default Alert;
