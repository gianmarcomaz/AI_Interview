import React from 'react';

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

interface SelectTriggerProps {
  children: React.ReactNode;
  className?: string;
}

interface SelectContentProps {
  children: React.ReactNode;
}

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
}

interface SelectValueProps {
  placeholder?: string;
  value?: string;
  children?: React.ReactNode;
}

// Simple Select component using native HTML select
export const Select: React.FC<SelectProps> = ({ value, onValueChange, children }) => {
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onValueChange?.(event.target.value);
  };

  return (
    <select
      value={value || ''}
      onChange={handleChange}
      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </select>
  );
};

// These are now just for compatibility - they render as option elements
export const SelectTrigger: React.FC<SelectTriggerProps> = ({ children: _children }) => null;
export const SelectContent: React.FC<SelectContentProps> = ({ children: _children }) => null;
export const SelectValue: React.FC<SelectValueProps> = ({ children: _children }) => null;


export const SelectItem: React.FC<SelectItemProps> = ({ value, children }) => (
  <option value={value}>{children}</option>
);
