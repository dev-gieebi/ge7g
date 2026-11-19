import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BadgePercent, ChevronRight, ShoppingBag } from "lucide-react";
import { date, money } from "@/lib/format";
import { Loading } from "@/components/ui";
import { clientApi, useProfilClient } from "./espaceClient";

const TONS: Record<string, string> = {
  en_attente: "bg-amber-100 text-amber-800",
  validee: "bg-emerald-100 text-emerald-800",
  en_preparation: "bg-sky-100 text-sky-800",
  en_livraison: "bg-violet-100 text-violet-800",
  livree: "bg-emerald-600 text-white",
  refusee: "bg-rose-100 text-rose-700",
  annulee: "bg-rose-100 text-rose-700",
  echec_livraison: "bg-rose-100 text-rose-700",
};

/** Espace client : liste de ses commandes, nouveautés de l'équipe signalées. */
export function ClientOrdersPage() {
  const [page, setPage] = useState(1);
  const [etat, setEtat] = useState<"en_cours" | "terminees" | undefined>(undefined);
  const profil = useProfilClient();
  const { data, isLoading } = useQuery({
    queryKey: ["client", "commandes", page, etat],
    queryFn: () => clientApi.commandes(page, etat),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Mes commandes</h1>
          <p className="mt-1 text-sm text-ge7-black/60">
            {profil.data?.nom}
            {profil.data && <> · {profil.data.zone ? `Ville : ${profil.data.zone.name}` : "Toutes les villes"}</>}
          </p>
        </div>
        <Link to="/mon-compte/commander" className="inline-flex items-center gap-2 rounded-full bg-ge7-gold px-5 py-2.5 text-sm font-bold text-ge7-black transition hover:brightness-110">
          <ShoppingBag size={16} /> Nouvelle commande
        </Link>
      </div>

      {/* Historique complet : les commandes terminées restent consultables avec toutes leurs données. */}
      <div className="mt-5 flex gap-2">
        {([[undefined, "Toutes"], ["en_cours", "En cours"], ["terminees", "Terminées"]] as const).map(([v, l]) => (
          <button
            key={l}
            onClick={() => { setEtat(v); setPage(1); }}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${etat === v ? "bg-ge7-black text-ge7-gold-light" : "bg-white text-ge7-black/70 hover:bg-ge7-gold-soft/50"}`}
          >
            {l}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Loading />
      ) : !data || data.data.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-ge7-black/15 bg-white/60 px-6 py-12 text-center text-sm text-ge7-black/50">
          Aucune commande pour le moment. Cliquez sur « Nouvelle commande » pour passer votre première commande.
        </p>
      ) : (
        <>
          <ul className="mt-6 space-y-2.5">
            {data.data.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/mon-compte/commandes/${c.id}`}
                  className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3.5 transition hover:border-ge7-gold/60 hover:shadow-soft ${c.non_lu ? "border-ge7-gold" : "border-ge7-black/10"}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-extrabold">{c.numero}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TONS[c.statut] ?? "bg-ge7-black/5"}`}>{c.statut_libelle}</span>
                      {c.non_lu && <span className="rounded-full bg-ge7-gold px-2 py-0.5 text-[11px] font-bold text-ge7-black">Nouveau</span>}
                      {c.remise_statut && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ge7-bronze">
                          <BadgePercent size={12} /> Remise {c.remise_statut === "demandee" ? "demandée" : c.remise_statut === "accordee" ? "accordée" : "refusée"}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-ge7-black/50">{date(c.cree_le)} · {c.ville}</p>
                  </div>
                  {c.total !== null && <span className="shrink-0 font-extrabold text-ge7-bronze">{money(c.total)}</span>}
                  <ChevronRight size={18} className="shrink-0 text-ge7-black/30" />
                </Link>
              </li>
            ))}
          </ul>
          {data.meta.last_page > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-full border border-ge7-black/15 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40">Précédent</button>
              <span className="text-sm text-ge7-black/60">Page {data.meta.current_page} / {data.meta.last_page}</span>
              <button disabled={page >= data.meta.last_page} onClick={() => setPage((p) => p + 1)} className="rounded-full border border-ge7-black/15 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40">Suivant</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
