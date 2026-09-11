import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

function Wrap({
  label,
  error,
  hint,
  children,
  className = "",
}: {
  label?: string;
  error?: string | string[];
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  const err = Array.isArray(error) ? error[0] : error;
  return (
    <div className={className}>
      {label && <label className="ge7-label">{label}</label>}
      {children}
      {err ? (
        <p className="mt-1 text-xs font-medium text-rose-600">{err}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ge7-black/50">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({
  label,
  error,
  hint,
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string | string[]; hint?: string }) {
  return (
    <Wrap label={label} error={error} hint={hint} className={className}>
      <input className={`ge7-input ${error ? "border-rose-400" : ""}`} {...rest} />
    </Wrap>
  );
}

export function Select({
  label,
  error,
  hint,
  className = "",
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string | string[]; hint?: string }) {
  return (
    <Wrap label={label} error={error} hint={hint} className={className}>
      <select className={`ge7-input ${error ? "border-rose-400" : ""}`} {...rest}>
        {children}
      </select>
    </Wrap>
  );
}

export function Textarea({
  label,
  error,
  hint,
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string | string[]; hint?: string }) {
  return (
    <Wrap label={label} error={error} hint={hint} className={className}>
      <textarea rows={3} className={`ge7-input ${error ? "border-rose-400" : ""}`} {...rest} />
    </Wrap>
  );
}

export function FormGrid({ children, cols = 2 }: { children: ReactNode; cols?: 1 | 2 | 3 }) {
  const map = { 1: "grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3" };
  return <div className={`grid gap-4 ${map[cols]}`}>{children}</div>;
}
