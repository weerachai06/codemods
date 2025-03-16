import React from "react";

interface ExpectedProps {
  variant: "primary" | "secondary";
  ref: React.RefObject<HTMLInputElement>;
}

const Alert = ({
  className,
  variant,
  ref,
  ...props
}: ExpectedProps & React.HTMLAttributes<HTMLInputElement>) => (
  <input ref={ref} />
);

export default Alert;
