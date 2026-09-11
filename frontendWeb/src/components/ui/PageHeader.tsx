import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
  breadcrumb,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {breadcrumb && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ge7-bronze">{breadcrumb}</div>}
        <h1 className="text-2xl font-extrabold text-ge7-black sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-ge7-black/60">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
