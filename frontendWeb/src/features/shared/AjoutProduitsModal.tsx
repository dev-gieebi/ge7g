import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import type { PosProduct } from "@/types";
import { getList } from "@/lib/api";
import { money, qty } from "@/lib/format";
import { Button, Modal, NumberField, SearchInput } from "@/components/ui";

export interface LigneAjout {
  product_id: number;
  quantity: number;
  unit_price: number;
}

interface Ligne extends LigneAjout {
  produit: PosProduct;
}

/**
 * Ajout de produits à une proforma (non validée) ou à une vente déjà
 * enregistrée : produits et prix du barème de la ville du document. Le prix
 * peut être majoré, jamais descendre sous le barème. Pour une vente
 * (`montrerStock`), on ne peut pas ajouter plus que le stock disponible ni
 * un produit en rupture.
 */
export function AjoutProduitsModal({
  zoneId,
  titre,
  montrerStock,
  enCours,
  onClose,
  onValider,
}: {
  zoneId: number | null | undefined;
  titre: string;
  montrerStock?: boolean;
  enCours?: boolean;
  onClose: () => void;
  onValider: (lignes: LigneAjout[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [lignes, setLignes] = useState<Ligne[]>([]);

  const produits = useQuery({
    queryKey: ["pos-products", "ajout", zoneId, search],
    queryFn: () => getList<PosProduct>("/pos/products", { search: search || undefined, per_page: 30, zone_id: zoneId ?? undefined }),
  });

  const dispo = (p: PosProduct) => Math.max(0, Number(p.available_quantity));
  const ajouter = (p: PosProduct) =>
    setLignes((ls) =>
      ls.some((l) => l.product_id === p.id)
        ? ls.map((l) => (l.product_id === p.id ? { ...l, quantity: montrerStock ? Math.min(l.quantity + 1, dispo(p)) : l.quantity + 1 } : l))
        : [...ls, { product_id: p.id, quantity: 1, unit_price: Number(p.sale_price), produit: p }],
    );
  // Vente : quantité au-delà du stock disponible = ligne en erreur, ajout bloqué.
  const depasse = (l: Ligne) => !!montrerStock && l.quantity > dispo(l.produit);
  const enErreur = lignes.some(depasse);
  const maj = (id: number, patch: Partial<LigneAjout>) => setLignes((ls) => ls.map((l) => (l.product_id === id ? { ...l, ...patch } : l)));
  const total = lignes.reduce((s, l) => s + l.quantity * l.unit_price, 0);

  return (
    <Modal
      title={titre}
      subtitle="Choisissez les produits à ajouter, puis ajustez quantités et prix."
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button loading={enCours} disabled={lignes.length === 0 || enErreur} onClick={() => onValider(lignes.map(({ product_id, quantity, unit_price }) => ({ product_id, quantity, unit_price })))}>
            Ajouter {lignes.length > 0 ? `(${money(total)})` : ""}
          </Button>
        </>
      }
    >
      <SearchInput value={search} onChange={setSearch} placeholder="Nom ou référence du produit…" />
      <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {(produits.data?.data ?? []).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => ajouter(p)}
            disabled={montrerStock && dispo(p) <= 0}
            title={montrerStock && dispo(p) <= 0 ? "Rupture de stock : ce produit ne peut pas être ajouté" : undefined}
            className="flex items-center justify-between gap-2 rounded-xl border border-ge7-black/10 px-3 py-2 text-left text-sm transition hover:border-ge7-gold hover:bg-ge7-gold-soft/40 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-ge7-black/10 disabled:hover:bg-transparent"
          >
            <span className="min-w-0">
              <span className="block truncate font-semibold">{p.name}{p.type ? ` · ${p.type}` : ""}</span>
              <span className="block text-xs text-ge7-black/50">
                {money(p.sale_price)}{montrerStock ? (dispo(p) > 0 ? ` · dispo ${qty(p.available_quantity, p.unit?.symbol)}` : " · rupture") : ""}
              </span>
            </span>
            <Plus size={16} className="shrink-0 text-ge7-bronze" />
          </button>
        ))}
        {produits.data?.data.length === 0 && <p className="col-span-full py-4 text-center text-sm text-ge7-black/50">Aucun produit avec un barème pour cette ville.</p>}
      </div>

      {lignes.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-ge7-black/10 pt-3">
          {lignes.map((l) => (
            <div key={l.product_id} className={`flex flex-wrap items-center gap-2 rounded-xl p-2.5 ${depasse(l) ? "bg-rose-50 ring-1 ring-rose-300" : "bg-ge7-cream"}`}>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{l.produit.name}{l.produit.type ? ` · ${l.produit.type}` : ""}</span>
              <NumberField min={0} step="any" value={l.quantity} onValue={(q) => maj(l.product_id, { quantity: q })} aria-label="Quantité" className="w-20 rounded-lg border border-ge7-black/15 bg-white px-2 py-1.5 text-center text-sm font-semibold focus:border-ge7-gold focus:outline-none" />
              <NumberField
                min={l.produit.sale_price}
                step="any"
                value={l.unit_price}
                valide={(p) => p >= Number(l.produit.sale_price)}
                onValue={(p) => maj(l.product_id, { unit_price: p })}
                aria-label="Prix unitaire"
                title={`Prix unitaire (minimum ${money(l.produit.sale_price)})`}
                className="w-[6.5rem] rounded-lg border border-ge7-black/15 bg-white px-2 py-1.5 text-right text-sm font-semibold focus:border-ge7-gold focus:outline-none"
              />
              <span className="w-28 text-right text-sm font-bold">{money(l.quantity * l.unit_price)}</span>
              <button type="button" onClick={() => setLignes((ls) => ls.filter((x) => x.product_id !== l.product_id))} className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50" title="Retirer">
                <Trash2 size={15} />
              </button>
              {depasse(l) && (
                <p className="w-full text-xs font-semibold text-rose-700">
                  Stock insuffisant : il ne reste que {qty(dispo(l.produit), l.produit.unit?.symbol)}, impossible d'en ajouter {qty(l.quantity, l.produit.unit?.symbol)}.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
