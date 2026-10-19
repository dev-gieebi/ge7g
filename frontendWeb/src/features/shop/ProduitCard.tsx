import { useState } from "react";
import { money } from "@/lib/format";
import type { ShopProduit } from "./api";
import { ProduitModal } from "./ProduitModal";

export const DISPONIBILITE: Record<ShopProduit["disponibilite"], { label: string; className: string }> = {
  disponible: { label: "Disponible", className: "bg-emerald-100 text-emerald-800" },
  stock_limite: { label: "Stock limité", className: "bg-amber-100 text-amber-800" },
  rupture: { label: "Sur commande", className: "bg-amber-100 text-amber-800" },
};

export function ProduitCard({ p }: { p: ShopProduit }) {
  const [open, setOpen] = useState(false);
  const dispo = DISPONIBILITE[p.disponibilite];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex flex-col overflow-hidden rounded-2xl border border-ge7-black/10 bg-white text-left transition hover:-translate-y-0.5 hover:border-ge7-gold/60 hover:shadow-soft"
      >
        <div className="relative aspect-[4/2] w-full bg-ge7-black/[0.03]">
          {p.image ? (
            <img src={p.image} alt={p.designation} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full place-items-center font-display text-3xl font-extrabold text-ge7-black/15">
              {p.designation.slice(0, 2).toUpperCase()}
            </span>
          )}
          <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${dispo.className}`}>{dispo.label}</span>
        </div>
        <div className="flex flex-1 flex-col p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ge7-black/40">{p.categorie ?? p.reference}</p>
          <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug">{p.designation}</p>
          <p className="mt-auto pt-2 text-base font-extrabold text-ge7-bronze">
            {money(p.prix)} <span className="text-xs font-medium text-ge7-black/40">{p.unite ? `/ ${p.unite}` : ""}</span>
          </p>
        </div>
      </button>
      {open && <ProduitModal produitId={p.id} onClose={() => setOpen(false)} />}
    </>
  );
}
