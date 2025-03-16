import React from "react";

interface RefProps {
  ref: React.RefObject<HTMLInputElement>;
}

interface SearchInputProps {
  placeholder?: string;
  onChange?: (value: string) => void;
}

const SearchInput = ({
  ref: ref,
  placeholder,
  onChange,
}: SearchInputProps & RefProps) => {
  return (
    <input
      type="search"
      ref={ref}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
};

export default SearchInput;
