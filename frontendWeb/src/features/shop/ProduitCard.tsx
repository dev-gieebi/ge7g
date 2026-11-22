import { useState } from "react";
import { money } from "@/lib/format";
import { ImageOuInitiales, initiales } from "@/components/ui/ImageOuInitiales";
import type { ShopProduit } from "./api";
import { ProduitModal } from "./ProduitModal";
import { useEstClient } from "./espaceClient";

export const DISPONIBILITE: Record<ShopProduit["disponibilite"], { label: string; className: string }> = {
  disponible: { label: "Disponible", className: "bg-emerald-100 text-emerald-800" },
  stock_limite: { label: "Stock limité", className: "bg-amber-100 text-amber-800" },
  rupture: { label: "Sur commande", className: "bg-amber-100 text-amber-800" },
};

export function ProduitCard({ p }: { p: ShopProduit }) {
  const [open, setOpen] = useState(false);
  const estClient = useEstClient();
  const dispo = DISPONIBILITE[p.disponibilite];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex flex-col rounded-3xl border border-ge7-black/5 bg-white p-3 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-ge7-gold"
      >
        <div className="relative mb-3 grid h-28 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-ge7-gold-soft to-ge7-pearl">
          <ImageOuInitiales
            src={p.image}
            alt={p.designation}
            loading="lazy"
            className="h-full w-full object-cover"
            fallback={<span className="font-display text-3xl font-extrabold text-ge7-bronze/60">{initiales(p.designation)}</span>}
          />
          {/* Le compte client ne voit pas le stock : il commande quoi qu'il arrive. */}
          {!estClient && <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${dispo.className}`}>{dispo.label}</span>}
        </div>
        <div className="flex flex-1 flex-col">
          <p className="font-bold leading-tight">{p.designation}</p>
          <p className="font-mono text-[11px] font-semibold text-ge7-black/40">{p.reference}</p>
          {p.categorie && <p className="text-xs text-ge7-black/50">{p.categorie}</p>}
          <p className="mt-auto pt-2 font-extrabold text-ge7-bronze">
            {money(p.prix)} <span className="text-xs font-medium text-ge7-black/40">{p.unite ? `/ ${p.unite}` : ""}</span>
          </p>
        </div>
      </button>
      {open && <ProduitModal produitId={p.id} onClose={() => setOpen(false)} />}
    </>
  );
}
