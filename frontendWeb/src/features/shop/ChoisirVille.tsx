import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { shopApi } from "./api";
import { useCart } from "./cart";

/** Valeur du paramètre `zone` envoyé à l'API : id de zone ou « toutes ». */
export function zoneParam(zone: { id: number | null } | null): string | number | undefined {
  if (!zone) return undefined;
  return zone.id ?? "toutes";
}

/** Écran invitant à choisir la ville avant d'afficher produits et prix. */
export function ChoisirVille({ titre = "Choisissez votre ville pour afficher les produits et leurs prix." }: { titre?: string }) {
  const cart = useCart();
  const { data: zones } = useQuery({ queryKey: ["shop", "zones"], queryFn: shopApi.zones, staleTime: 30 * 60_000 });

  return (
    <div className="mx-auto max-w-md py-14 text-center">
      <MapPin size={44} className="mx-auto text-ge7-gold" />
      <h2 className="mt-4 font-display text-xl font-extrabold">Choisissez votre ville</h2>
      <p className="mt-2 text-sm text-ge7-black/60">{titre}</p>
      <div className="relative mx-auto mt-6 max-w-xs">
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
    </div>
  );
}
