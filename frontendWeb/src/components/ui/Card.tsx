import type { HTMLAttributes, ReactNode } from "react";

export function Card({
  children,
  className = "",
  padded = true,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode; padded?: boolean }) {
  return (
    <div
      className={`rounded-3xl border border-ge7-black/5 bg-white shadow-soft ${padded ? "p-5 sm:p-6" : ""} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-base font-bold sm:text-lg">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-ge7-black/55">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
