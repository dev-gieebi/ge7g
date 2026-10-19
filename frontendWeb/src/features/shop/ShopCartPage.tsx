import { Link } from "react-router-dom";
import { ArrowRight, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { money } from "@/lib/format";
import { useCart } from "./cart";

export function ShopCartPage() {
  const cart = useCart();

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <ShoppingCart size={44} className="mx-auto text-ge7-black/20" />
        <h1 className="mt-4 font-display text-2xl font-extrabold">Votre panier est vide</h1>
        <p className="mt-2 text-sm text-ge7-black/60">Parcourez le catalogue et ajoutez des produits.</p>
        <Link to="/produits" className="mt-6 inline-flex items-center gap-2 rounded-full bg-ge7-gold px-5 py-2.5 text-sm font-bold text-ge7-black">
          Voir le catalogue <ArrowRight size={15} />
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-extrabold">Panier</h1>

      <div className="mt-5 divide-y divide-ge7-black/10 overflow-hidden rounded-2xl border border-ge7-black/10 bg-white">
        {cart.items.map((i) => (
          <div key={i.produit_id} className="flex items-center gap-3 p-4">
            <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-ge7-black/[0.04] text-sm font-bold text-ge7-black/30">
              {i.image ? <img src={i.image} alt="" className="h-full w-full object-cover" /> : i.designation.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{i.designation}</p>
              <p className="text-xs text-ge7-black/50">{money(i.prix)}</p>
            </div>
            <div className="flex items-center rounded-full border border-ge7-black/15">
              <button onClick={() => cart.setQuantite(i.produit_id, i.quantite - 1)} className="p-2 text-ge7-black/60 hover:text-ge7-black"><Minus size={14} /></button>
              <span className="w-8 text-center text-sm font-bold">{i.quantite}</span>
              <button onClick={() => cart.setQuantite(i.produit_id, i.quantite + 1)} className="p-2 text-ge7-black/60 hover:text-ge7-black"><Plus size={14} /></button>
            </div>
            <p className="w-24 text-right text-sm font-bold">{money(i.prix * i.quantite)}</p>
            <button onClick={() => cart.remove(i.produit_id)} className="p-2 text-ge7-black/40 hover:text-rose-600" aria-label="Retirer">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between rounded-2xl bg-[#151515] px-5 py-4 text-white">
        <div>
          <p className="text-xs text-white/60">Total (paiement à la livraison)</p>
          <p className="text-xl font-extrabold text-ge7-gold">{money(cart.total)}</p>
        </div>
        <Link to="/commande" className="inline-flex items-center gap-2 rounded-full bg-ge7-gold px-5 py-2.5 text-sm font-bold text-ge7-black transition hover:brightness-110">
          Commander <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}
