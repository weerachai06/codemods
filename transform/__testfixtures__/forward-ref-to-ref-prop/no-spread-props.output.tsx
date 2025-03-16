import React from "react";

interface RefProps {
  ref: React.RefObject<HTMLInputElement>;
}

interface ExpectedProps {
  variant: "primary" | "secondary";
}

const Alert = ({
  ref: ref,
  ...props
}: React.HTMLAttributes<HTMLInputElement> & ExpectedProps & RefProps) => {
  const { className, variant } = props;
  return <input ref={ref} className={className} />;
};

export default Alert;
