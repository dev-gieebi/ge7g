const fcfa = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "XOF",
  maximumFractionDigits: 0,
});

const num = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

export const money = (v: number | string | null | undefined) =>
  fcfa.format(Number(v ?? 0)).replace("F CFA", "FCFA");

export const qty = (v: number | string | null | undefined, unit?: string) =>
  `${num.format(Number(v ?? 0))}${unit ? ` ${unit}` : ""}`;

export const percent = (v: number | null | undefined) =>
  `${num.format(Number(v ?? 0))} %`;

export const date = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString("fr-FR") : "—";

export const datetime = (v: string | null | undefined) =>
  v
    ? new Date(v).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const relative = (v: string | null | undefined) => {
  if (!v) return "—";
  const diff = Math.round((Date.now() - new Date(v).getTime()) / 1000);
  if (diff < 60) return `il y a ${diff} s`;
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
};

export const humanize = (s: string | null | undefined) =>
  (s ?? "").replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
