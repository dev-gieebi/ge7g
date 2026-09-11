import type { ReactNode } from "react";
import { humanize } from "@/lib/format";

type Tone = "gold" | "purple" | "dark" | "green" | "red" | "amber" | "blue" | "gray";

const tones: Record<Tone, string> = {
  gold: "bg-ge7-gold-soft text-ge7-bronze border-ge7-gold/40",
  purple: "bg-ge7-purple-soft text-ge7-purple border-ge7-purple/30",
  dark: "bg-ge7-black text-ge7-gold-light border-ge7-black",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  red: "bg-rose-50 text-rose-700 border-rose-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  blue: "bg-sky-50 text-sky-700 border-sky-200",
  gray: "bg-slate-100 text-slate-600 border-slate-200",
};

export function Badge({
  children,
  tone = "gray",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  ACTIF: "green",
  INACTIF: "gray",
  DISPONIBLE: "green",
  INDISPONIBLE: "gray",
  MAINTENANCE: "amber",
  BROUILLON: "gray",
  EN_ATTENTE: "amber",
  VALIDEE: "blue",
  EN_PREPARATION: "purple",
  PRETE: "gold",
  EN_LIVRAISON: "blue",
  EN_MISSION: "blue",
  LIVREE: "green",
  PARTIELLEMENT_LIVREE: "amber",
  RECEPTION_CONFIRMEE: "green",
  CLOTUREE: "dark",
  REFUSEE: "red",
  ANNULEE: "red",
  ANNULE: "red",
  AFFECTEE: "purple",
  DEPART: "blue",
  ARRIVEE: "gold",
  TERMINEE: "green",
  COMMANDE: "blue",
  RECU_PARTIEL: "amber",
  RECU: "green",
  EMISE: "blue",
  PAYEE: "green",
  PARTIELLEMENT_PAYEE: "amber",
  ENTREE: "green",
  SORTIE: "red",
  AJUSTEMENT: "amber",
  RESERVATION: "purple",
  LIVRAISON: "blue",
  TRANSFERT: "blue",
  VENTE: "gold",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge>—</Badge>;
  return <Badge tone={STATUS_TONES[status] ?? "gray"}>{humanize(status)}</Badge>;
}
