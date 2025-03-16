import React from "react";

interface SearchInputProps {
  placeholder?: string;
  onChange?: (value: string) => void;
  ref: React.RefObject<HTMLInputElement>;
}

const SearchInput = ({ ref: ref, placeholder, onChange }: SearchInputProps) => {
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
