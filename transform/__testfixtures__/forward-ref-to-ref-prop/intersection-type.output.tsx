import React from "react";

interface ExpectedProps {
  variant: "primary" | "secondary";
  ref: React.RefObject<HTMLInputElement>;
}

const Alert = ({
  ref: ref,
  className,
  variant,
  ...props
}: ExpectedProps & React.HTMLAttributes<HTMLInputElement>) => (
  <input ref={ref} />
);

export default Alert;
