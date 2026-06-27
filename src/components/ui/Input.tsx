import type { InputHTMLAttributes } from 'react';

export default function Input({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-accent ${className}`}
      {...props}
    />
  );
}
