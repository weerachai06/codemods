import React from "react";

interface RefProps {
  ref: React.RefObject<HTMLInputElement>;
}

interface ExpectedProps {
  variant: "primary" | "secondary";
  ref: React.RefObject<HTMLInputElement>;
}

const Alert = ({
  ref: ref,
  className,
  variant,
  ...props
}: ExpectedProps & React.HTMLAttributes<HTMLInputElement> & RefProps) => (
  <input ref={ref} />
);

export default Alert;
