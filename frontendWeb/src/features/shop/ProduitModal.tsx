import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Minus, Plus, ShoppingCart, X } from "lucide-react";
import { money } from "@/lib/format";
import { Loading, ErrorState } from "@/components/ui";
import { shopApi } from "./api";
import { useCart } from "./cart";
import { zoneParam } from "./ChoisirVille";
import { DISPONIBILITE } from "./ProduitCard";

/** Modal de détail produit — mêmes informations que la fiche /produits/:id. */
export function ProduitModal({ produitId, onClose }: { produitId: number; onClose: () => void }) {
  const cart = useCart();
  const [quantite, setQuantite] = useState(1);
  const [added, setAdded] = useState(false);

  const { data: p, isLoading, isError } = useQuery({
    queryKey: ["shop", "produit", produitId, zoneParam(cart.zone)],
    queryFn: () => shopApi.produit(produitId, zoneParam(cart.zone)),
    retry: false,
  });

  // Échap ferme la modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dispo = p ? DISPONIBILITE[p.disponibilite] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-4 sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 text-ge7-black/60 shadow-sm transition hover:text-ge7-black"
          aria-label="Fermer"
        >
          <X size={18} />
        </button>

        {isLoading ? (
          <div className="py-16"><Loading /></div>
        ) : isError || !p ? (
          <ErrorState message="Produit introuvable ou sans prix pour cette ville." />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-ge7-black/10">
              <div className="relative aspect-[5/3] bg-ge7-black/[0.03]">
                {p.image ? (
                  <img src={p.image} alt={p.designation} className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full place-items-center font-display text-5xl font-extrabold text-ge7-black/15">
                    {p.designation.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold ${dispo!.className}`}>{dispo!.label}</span>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ge7-black/40">{p.categorie ?? p.reference}</p>
              <h2 className="mt-1 font-display text-xl font-extrabold leading-tight">{p.designation}</h2>
              <p className="mt-2 text-2xl font-extrabold text-ge7-bronze">
                {money(p.prix)} <span className="text-sm font-medium text-ge7-black/40">{p.unite ? `/ ${p.unite}` : ""}</span>
              </p>

              {p.description && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ge7-black/70">{p.description}</p>}

              <div className="mt-5 flex items-center gap-3">
                <div className="flex items-center rounded-full border border-ge7-black/15 bg-white">
                  <button onClick={() => setQuantite((q) => Math.max(1, q - 1))} className="p-3 text-ge7-black/60 hover:text-ge7-black" aria-label="Diminuer">
                    <Minus size={14} />
                  </button>
                  <span className="w-10 text-center font-bold">{quantite}</span>
                  <button onClick={() => setQuantite((q) => Math.min(99, q + 1))} className="p-3 text-ge7-black/60 hover:text-ge7-black" aria-label="Augmenter">
                    <Plus size={14} />
                  </button>
                </div>
                <button
                  onClick={() => {
                    cart.add({ produit_id: p.id, designation: p.designation, prix: p.prix, image: p.image }, quantite);
                    setAdded(true);
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-ge7-gold px-5 py-3 text-sm font-bold text-ge7-black transition hover:brightness-110"
                >
                  <ShoppingCart size={14} /> Ajouter au panier
                </button>
              </div>

              {added && (
                <div className="mt-3 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                  <span className="font-semibold text-emerald-800">Ajouté au panier</span>
                  <Link to="/panier" onClick={onClose} className="font-bold text-emerald-900 underline">Voir le panier</Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
