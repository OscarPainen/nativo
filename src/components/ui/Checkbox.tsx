import type { InputHTMLAttributes, ReactNode } from 'react';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
}

export default function Checkbox({ label, className = '', ...props }: CheckboxProps) {
  return (
    <label className={`flex cursor-pointer items-start gap-2 text-sm text-foreground ${className}`}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--color-accent))]"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}
