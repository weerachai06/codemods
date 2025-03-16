import React from "react";

interface SearchInputProps {
  placeholder?: string;
  onChange?: (value: string) => void;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ placeholder, onChange }, ref) => {
    return (
      <input
        type="search"
        ref={ref}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
      />
    );
  },
);

export default SearchInput;
