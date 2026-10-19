import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Check, MapPin, PackageSearch, Truck, TriangleAlert } from "lucide-react";
import { datetime, money, relative } from "@/lib/format";
import { Loading } from "@/components/ui";
import { CommandeMap } from "@/features/orders/CommandeMap";
import { shopApi, type SuiviCommande } from "./api";

export function ShopTrackingResultPage() {
  const location = useLocation();
  const state = location.state as { suivi?: SuiviCommande; numero?: string; telephone?: string } | null;

  // Suivi relancé en continu (15 s) : la position du chauffeur bouge
  // pendant la livraison. Les identifiants restent en état de navigation.
  const { data: suivi } = useQuery({
    queryKey: ["shop", "suivi", state?.numero, state?.telephone],
    queryFn: () => shopApi.suivi(state!.numero!, state!.telephone!),
    enabled: !!state?.numero && !!state?.telephone,
    initialData: state?.suivi,
    refetchInterval: 15_000,
    retry: false,
  });

  if (!state?.numero) return <Navigate to="/suivi" replace />;
  if (!suivi) return <Loading />;

  const indisponible = ["refusee", "annulee", "echec_livraison"].includes(suivi.statut);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl bg-[#151515] p-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs text-white/50">Commande</p>
            <p className="font-mono text-xl font-extrabold">{suivi.numero}</p>
          </div>
          <span className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${indisponible ? "bg-rose-500/20 text-rose-200" : "bg-ge7-gold/20 text-ge7-gold-light"}`}>
            {suivi.statut_libelle}
          </span>
        </div>
        <p className="mt-1 text-xs text-white/50">Passée le {datetime(suivi.cree_le)} · {suivi.quartier}, {suivi.ville}</p>
        {suivi.chauffeur && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2.5 text-sm">
            <Truck size={16} className="text-ge7-gold" /> <span><strong>{suivi.chauffeur}</strong> est en route avec votre commande.</span>
          </p>
        )}
      </div>

      {/* Carte en direct : visible uniquement pendant la livraison. */}
      {suivi.statut === "en_livraison" && (
        <div className="mt-4">
          {suivi.position ? (
            <>
              <CommandeMap
                latitude={suivi.position.latitude}
                longitude={suivi.position.longitude}
                majLe={suivi.position.maj_le}
                label={`${suivi.chauffeur ?? "Le chauffeur"} — commande ${suivi.numero}`}
                height="h-80"
              />
              <p className="mt-2 flex items-center gap-1.5 text-xs text-ge7-black/50">
                <MapPin size={13} className="text-ge7-purple" />
                Position du chauffeur actualisée {relative(suivi.position.maj_le)} — la page se met à jour automatiquement.
              </p>
            </>
          ) : (
            <p className="flex items-center gap-2 rounded-2xl border border-ge7-black/10 bg-white px-4 py-3 text-sm text-ge7-black/60">
              <MapPin size={15} className="text-ge7-purple" /> En attente de la position du chauffeur…
            </p>
          )}
        </div>
      )}

      {suivi.motif && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <TriangleAlert size={17} className="mt-0.5 shrink-0 text-amber-600" />
          <div><p className="font-bold text-amber-900">{suivi.statut_libelle}</p><p className="text-amber-800">{suivi.motif}</p></div>
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-ge7-black/10 bg-white p-5">
        <p className="mb-4 text-sm font-bold">Progression</p>
        <ol className="space-y-0">
          {suivi.etapes.map((e, i) => {
            const active = e.statut === suivi.statut;
            const done = !!e.franchie_le;
            return (
              <li key={e.statut} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                    done ? "bg-ge7-gold text-ge7-black" : "border-2 border-ge7-black/15 text-ge7-black/30"
                  } ${active ? "ring-4 ring-ge7-gold/30" : ""}`}>
                    {done ? <Check size={14} /> : i + 1}
                  </span>
                  {i < suivi.etapes.length - 1 && <span className={`h-8 w-0.5 ${done ? "bg-ge7-gold" : "bg-ge7-black/10"}`} />}
                </div>
                <div className="pb-6 pt-0.5">
                  <p className={`text-sm font-semibold ${done ? "" : "text-ge7-black/35"} ${active ? "text-ge7-bronze" : ""}`}>{e.libelle}</p>
                  {e.franchie_le && <p className="text-xs text-ge7-black/50">{datetime(e.franchie_le)}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-5 rounded-2xl border border-ge7-black/10 bg-white p-5">
        <p className="mb-3 text-sm font-bold">Récapitulatif</p>
        <ul className="space-y-1.5 text-sm">
          {suivi.lignes.map((l, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">{l.quantite} × {l.designation}</span>
              <span className="shrink-0 font-semibold">{money(l.total_ligne)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-ge7-black/10 pt-3">
          <span className="text-sm font-bold">{suivi.statut === "livree" ? "Montant payé" : "À payer à la livraison"}</span>
          <span className="text-lg font-extrabold text-ge7-bronze">{money(suivi.total)}</span>
        </div>
      </div>

      <div className="mt-5 text-center">
        <Link to="/suivi" className="inline-flex items-center gap-2 text-sm font-semibold text-ge7-purple hover:underline">
          <PackageSearch size={15} /> Suivre une autre commande
        </Link>
      </div>
    </div>
  );
}
