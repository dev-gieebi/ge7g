import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { MapPin, Search } from "lucide-react";
import { shopApi } from "./api";
import { useCart } from "./cart";
import { zoneParam } from "./ChoisirVille";
import { ProduitCard } from "./ProduitCard";

export function ShopCatalogPage() {
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const categorie = params.get("categorie") ?? "";
  const search = params.get("search") ?? "";
  const [searchInput, setSearchInput] = useState(search);
  const cart = useCart();

  const { data: categories } = useQuery({ queryKey: ["shop", "categories"], queryFn: shopApi.categories, staleTime: 5 * 60_000 });
  const { data: zones } = useQuery({ queryKey: ["shop", "zones"], queryFn: shopApi.zones, staleTime: 30 * 60_000 });
  const zone = zoneParam(cart.zone);
  const { data, isLoading } = useQuery({
    queryKey: ["shop", "catalogue", categorie, search, page, zone],
    queryFn: () => shopApi.produits({ categorie: categorie || undefined, search: search || undefined, zone, page, per_page: 24 }),
    enabled: !!cart.zone,
    placeholderData: keepPreviousData,
  });

  const set = (key: string, value: string) => {
    setPage(1);
    setParams((p) => {
      value ? p.set(key, value) : p.delete(key);
      return p;
    });
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold">Catalogue</h1>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        {/* Ville de livraison — les produits et prix affichés suivent le barème de la ville, comme à la caisse. */}
        <div className="relative sm:w-56">
          <MapPin size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ge7-bronze" />
          <select
            value={cart.zone ? String(cart.zone.id ?? "toutes") : ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") cart.setZone(null);
              else if (v === "toutes") cart.setZone({ id: null, name: "Toutes les villes" });
              else {
                const z = zones?.find((x) => x.id === Number(v));
                if (z) cart.setZone({ id: z.id, name: z.name });
              }
            }}
            className="w-full cursor-pointer appearance-none rounded-full border border-ge7-black/15 bg-white py-2.5 pl-9 pr-4 text-sm font-semibold focus:border-ge7-gold focus:outline-none"
          >
            <option value="">Choisir une ville…</option>
            <option value="toutes">Toutes les villes</option>
            {zones?.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            set("search", searchInput.trim());
          }}
          className="relative flex-1"
        >
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ge7-black/40" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Rechercher un produit…"
            className="w-full rounded-full border border-ge7-black/15 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-ge7-gold focus:outline-none"
          />
        </form>
        <select
          value={categorie}
          onChange={(e) => set("categorie", e.target.value)}
          className="rounded-full border border-ge7-black/15 bg-white px-4 py-2.5 text-sm focus:border-ge7-gold focus:outline-none"
        >
          <option value="">Toutes les catégories</option>
          {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {!cart.zone && (
        <p className="mt-6 rounded-2xl border border-dashed border-ge7-black/15 bg-white/60 px-6 py-10 text-center text-sm text-ge7-black/50">
          Choisissez votre ville pour afficher les produits et leurs prix.
        </p>
      )}

      {cart.zone && (isLoading ? (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-ge7-black/5" />)}
        </div>
      ) : data && data.data.length > 0 ? (
        <>
          <p className="mt-4 text-xs text-ge7-black/50">{data.meta.total} produit(s)</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
            {data.data.map((p) => <ProduitCard key={p.id} p={p} />)}
          </div>
          {data.meta.last_page > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-full border border-ge7-black/15 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40">
                Précédent
              </button>
              <span className="text-sm text-ge7-black/60">Page {data.meta.current_page} / {data.meta.last_page}</span>
              <button disabled={page >= data.meta.last_page} onClick={() => setPage((p) => p + 1)} className="rounded-full border border-ge7-black/15 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40">
                Suivant
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="mt-8 rounded-2xl border border-dashed border-ge7-black/15 bg-white/60 px-6 py-12 text-center text-sm text-ge7-black/50">
          Aucun produit ne correspond à votre recherche.
        </p>
      ))}
    </div>
  );
}
