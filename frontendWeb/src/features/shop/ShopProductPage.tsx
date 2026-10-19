import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Minus, Plus, ShoppingCart } from "lucide-react";
import { money } from "@/lib/format";
import { Loading, ErrorState } from "@/components/ui";
import { shopApi } from "./api";
import { useCart } from "./cart";
import { ChoisirVille, zoneParam } from "./ChoisirVille";
import { DISPONIBILITE } from "./ProduitCard";

export function ShopProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const cart = useCart();
  const [quantite, setQuantite] = useState(1);
  const [added, setAdded] = useState(false);

  const { data: p, isLoading, isError } = useQuery({
    queryKey: ["shop", "produit", id, zoneParam(cart.zone)],
    queryFn: () => shopApi.produit(id!, zoneParam(cart.zone)),
    enabled: !!id && !!cart.zone,
    retry: false,
  });

  // Le prix n'est affiché qu'après le choix de la ville.
  if (!cart.zone) return <ChoisirVille titre="Choisissez votre ville pour afficher le prix et commander." />;
  if (isLoading) return <Loading />;
  if (isError || !p) return <ErrorState message="Produit introuvable ou sans prix pour cette ville." />;

  const dispo = DISPONIBILITE[p.disponibilite];
  const rupture = p.disponibilite === "rupture";

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/produits" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ge7-purple hover:underline">
        <ArrowLeft size={15} /> Catalogue
      </Link>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border border-ge7-black/10 bg-white">
          <div className="relative aspect-square bg-ge7-black/[0.03]">
            {p.image ? (
              <img src={p.image} alt={p.designation} className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full place-items-center font-display text-6xl font-extrabold text-ge7-black/15">
                {p.designation.slice(0, 2).toUpperCase()}
              </span>
            )}
            <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold ${dispo.className}`}>{dispo.label}</span>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ge7-black/40">{p.categorie ?? p.reference}</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold leading-tight">{p.designation}</h1>
          <p className="mt-3 text-2xl font-extrabold text-ge7-bronze">
            {money(p.prix)} <span className="text-sm font-medium text-ge7-black/40">{p.unite ? `/ ${p.unite}` : ""}</span>
          </p>

          {p.description && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ge7-black/70">{p.description}</p>}

          <div className="mt-6 flex items-center gap-3">
            <div className="flex items-center rounded-full border border-ge7-black/15 bg-white">
              <button onClick={() => setQuantite((q) => Math.max(1, q - 1))} className="p-3 text-ge7-black/60 hover:text-ge7-black" aria-label="Diminuer">
                <Minus size={16} />
              </button>
              <span className="w-10 text-center font-bold">{quantite}</span>
              <button onClick={() => setQuantite((q) => Math.min(99, q + 1))} className="p-3 text-ge7-black/60 hover:text-ge7-black" aria-label="Augmenter">
                <Plus size={16} />
              </button>
            </div>
            <button
              onClick={() => {
                cart.add({ produit_id: p.id, designation: p.designation, prix: p.prix, image: p.image }, quantite);
                setAdded(true);
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-ge7-gold px-5 py-3 text-sm font-bold text-ge7-black transition hover:brightness-110"
            >
              <ShoppingCart size={17} /> Ajouter au panier
            </button>
          </div>
          {rupture && (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              Produit en rupture : commandable, il sera livré dès réapprovisionnement.
            </p>
          )}

          {added && (
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
              <span className="font-semibold text-emerald-800">Ajouté au panier</span>
              <button onClick={() => navigate("/panier")} className="font-bold text-emerald-900 underline">Voir le panier</button>
            </div>
          )}

          <p className="mt-6 rounded-2xl bg-ge7-black/[0.04] px-4 py-3 text-xs text-ge7-black/60">
            Paiement à la livraison — espèces, Airtel Money ou Moov Money. Prix confirmé à la commande.
          </p>
        </div>
      </div>
    </div>
  );
}
