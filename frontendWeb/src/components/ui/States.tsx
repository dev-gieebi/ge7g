import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";

export function Loading({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="grid place-items-center py-16 text-ge7-black/50">
      <Loader2 className="mb-2 animate-spin text-ge7-gold" size={28} />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="grid place-items-center rounded-3xl border border-rose-200 bg-rose-50 px-6 py-12 text-center">
      <AlertCircle className="mb-2 text-rose-600" size={28} />
      <p className="font-semibold text-rose-800">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Réessayer
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title = "Rien à afficher",
  hint,
  action,
}: {
  title?: string;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="grid place-items-center rounded-3xl border border-dashed border-ge7-black/15 px-6 py-12 text-center">
      <Inbox className="mb-2 text-ge7-gold" size={28} />
      <p className="font-semibold text-ge7-black/70">{title}</p>
      {hint && <div className="mt-1 text-sm text-ge7-black/50">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
