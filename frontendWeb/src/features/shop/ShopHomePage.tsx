import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin, ShieldCheck, Truck, Wallet } from "lucide-react";
import { shopApi } from "./api";
import { useCart } from "./cart";
import { ChoisirVille, zoneParam } from "./ChoisirVille";
import { ProduitCard } from "./ProduitCard";
import { GE7_COMPANY } from "@/features/shared/companyInfo";

export function ShopHomePage() {
  const cart = useCart();
  const zone = zoneParam(cart.zone);
  const { data: categories } = useQuery({ queryKey: ["shop", "categories"], queryFn: shopApi.categories, staleTime: 5 * 60_000 });
  const { data: zones } = useQuery({ queryKey: ["shop", "zones"], queryFn: shopApi.zones, staleTime: 30 * 60_000 });
  const { data: avant } = useQuery({ queryKey: ["shop", "avant", zone], queryFn: () => shopApi.produits({ mis_en_avant: true, zone, per_page: 8 }), enabled: !!cart.zone });
  const { data: catalogue } = useQuery({ queryKey: ["shop", "recents", zone], queryFn: () => shopApi.produits({ zone, per_page: 12 }), enabled: !!cart.zone });

  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-3xl bg-[#151515] px-6 py-10 text-white sm:px-10">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-ge7-gold">Boutique officielle</p>
        <h1 className="mt-3 max-w-2xl font-display text-3xl font-extrabold leading-tight sm:text-4xl">
          Équipements et fournitures industrielles, livrés partout au Gabon.
        </h1>
        <p className="mt-3 max-w-xl text-sm text-white/70">
          Commandez en ligne sans compte, payez à la livraison. Une question ? {GE7_COMPANY.phones}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/produits" className="inline-flex items-center gap-2 rounded-full bg-ge7-gold px-5 py-2.5 text-sm font-bold text-ge7-black transition hover:brightness-110">
            Voir le catalogue <ArrowRight size={16} />
          </Link>
          <Link to="/suivi" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10">
            Suivre ma commande
          </Link>
        </div>
        <div className="mt-8 grid gap-3 text-sm sm:grid-cols-3">
          {[
            { icon: Wallet, text: "Paiement à la livraison" },
            { icon: Truck, text: "Livraison à domicile" },
            { icon: ShieldCheck, text: "Commande sans compte" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <Icon size={18} className="shrink-0 text-ge7-gold" />
              <span className="font-semibold">{text}</span>
            </div>
          ))}
        </div>
      </section>

      {categories && categories.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-extrabold">Catégories</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link key={c.id} to={`/produits?categorie=${c.id}`} className="rounded-full border border-ge7-black/15 bg-white px-4 py-2 text-sm font-semibold transition hover:border-ge7-gold hover:bg-ge7-gold-soft">
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {!cart.zone ? (
        <section className="rounded-3xl border border-ge7-black/10 bg-white">
          <ChoisirVille />
        </section>
      ) : (
        <>
          {avant && avant.data.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-xl font-extrabold">Mis en avant</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
                {avant.data.map((p) => <ProduitCard key={p.id} p={p} />)}
              </div>
            </section>
          )}

          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-extrabold">Catalogue : {cart.zone.name}</h2>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <MapPin size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ge7-bronze" />
                  <select
                    value={String(cart.zone.id ?? "toutes")}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "toutes") cart.setZone({ id: null, name: "Toutes les villes" });
                      else {
                        const z = zones?.find((x) => x.id === Number(v));
                        if (z) cart.setZone({ id: z.id, name: z.name });
                      }
                    }}
                    className="cursor-pointer appearance-none rounded-full border border-ge7-black/15 bg-white py-2 pl-8 pr-4 text-sm font-semibold focus:border-ge7-gold focus:outline-none"
                    title="Changer de ville"
                  >
                    <option value="toutes">Toutes les villes</option>
                    {zones?.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                  </select>
                </div>
                <Link to="/produits" className="inline-flex items-center gap-1 text-sm font-semibold text-ge7-purple hover:underline">
                  Tout voir <ArrowRight size={14} />
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
              {(catalogue?.data ?? []).map((p) => <ProduitCard key={p.id} p={p} />)}
            </div>
            {catalogue && catalogue.data.length === 0 && (
              <p className="rounded-2xl border border-dashed border-ge7-black/15 bg-white/60 px-6 py-10 text-center text-sm text-ge7-black/50">
                Aucun produit avec un prix « {cart.zone.name} » pour le moment.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
