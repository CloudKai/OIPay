import { Label } from "radix-ui";
import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";

import { cn } from "@/lib/utils";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label.Root htmlFor={htmlFor} className="text-sm font-medium text-[var(--ink)]">
        {label}
      </Label.Root>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs font-medium text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-[var(--ink-subtle)]">{hint}</p>
      ) : null}
    </div>
  );
}

const control =
  "min-h-11 min-w-0 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-sm text-[var(--ink)] outline-none transition placeholder:text-[var(--ink-subtle)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--focus-soft)] disabled:bg-[var(--surface-muted)] disabled:text-[var(--ink-subtle)]";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />;
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(control, "min-h-24 resize-y py-3", className)}
      {...props}
    />
  );
}
