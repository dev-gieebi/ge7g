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
  v ? new Date(v).toLocaleDateString("fr-FR") : "";

export const datetime = (v: string | null | undefined) =>
  v
    ? new Date(v).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

export const relative = (v: string | null | undefined) => {
  if (!v) return "";
  const diff = Math.round((Date.now() - new Date(v).getTime()) / 1000);
  if (diff < 60) return `il y a ${diff} s`;
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
};

export const humanize = (s: string | null | undefined) =>
  (s ?? "").replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/* ===== Montants en lettres (français) ===== */

const UNITS = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
const TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];

const under100 = (n: number): string => {
  if (n < 20) return UNITS[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  // 70-79 et 90-99 : base 60/80 + 10 à 19.
  if (t === 7 || t === 9) {
    if (t === 7 && u === 1) return "soixante et onze";
    return `${TENS[t]}-${UNITS[10 + u]}`;
  }
  if (u === 0) return t === 8 ? "quatre-vingts" : TENS[t];
  if (u === 1 && t !== 8) return `${TENS[t]} et un`;
  return `${TENS[t]}-${UNITS[u]}`;
};

const under1000 = (n: number): string => {
  const c = Math.floor(n / 100);
  const r = n % 100;
  if (c === 0) return under100(n);
  const cents = c === 1 ? "cent" : `${UNITS[c]} cent`;
  // « cents » avec s seulement en fin de nombre (deux cents / deux cent un).
  if (r === 0) return c > 1 ? `${cents}s` : cents;
  return `${cents} ${under100(r)}`;
};

/** « cents »/« quatre-vingts » perdent le s devant mille/million/milliard. */
const beforeScale = (n: number) => under1000(n).replace(/(cent|quatre-vingt)s$/, "$1");

export const amountInWords = (v: number | string | null | undefined): string => {
  const n = Math.round(Math.abs(Number(v ?? 0)));
  if (n === 0) return "zéro";
  const parts: string[] = [];
  const milliards = Math.floor(n / 1e9);
  const millions = Math.floor((n % 1e9) / 1e6);
  const mille = Math.floor((n % 1e6) / 1e3);
  const reste = n % 1000;
  if (milliards) parts.push(`${beforeScale(milliards)} milliard${milliards > 1 ? "s" : ""}`);
  if (millions) parts.push(`${beforeScale(millions)} million${millions > 1 ? "s" : ""}`);
  if (mille) parts.push(mille === 1 ? "mille" : `${beforeScale(mille)} mille`);
  if (reste) parts.push(under1000(reste));
  return parts.join(" ");
};

/** « Un million quatre cent soixante-dix mille francs CFA » — formule légale des factures. */
export const moneyInWords = (v: number | string | null | undefined): string =>
  `${amountInWords(v).replace(/^\w/, (c) => c.toUpperCase())} francs CFA`;
