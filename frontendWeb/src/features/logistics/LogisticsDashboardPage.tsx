import { useQuery } from "@tanstack/react-query";
import { ModuleTabs } from "@/components/ui";
import { LOGISTIQUE_TABS } from "@/app/moduleTabs";
import { PackageCheck, Route, Truck, UserCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { getOne, toApiError } from "@/lib/api";
import type { CommandeListItem, CommandeStats } from "@/types";
import { usePaginated } from "@/lib/hooks";
import { money, relative } from "@/lib/format";
import { Card, CardHeader, ErrorState, KpiCard, Loading, PageHeader, StatusBadge } from "@/components/ui";

/**
 * Pilotage logistique : affectation des chauffeurs et suivi des livraisons
 * des commandes boutique (le chauffeur voit, lui, uniquement les siennes).
 */
export function LogisticsDashboardPage() {
  const stats = useQuery({ queryKey: ["commande-stats"], queryFn: () => getOne<CommandeStats>("/commandes/stats"), refetchInterval: 60_000 });
  const enCours = usePaginated<CommandeListItem>("commandes-logistique", "/commandes", { statut: "en_livraison", per_page: 10 }, true, 30_000);

  if (stats.isLoading) return <Loading />;
  if (stats.error || !stats.data) return <ErrorState message={toApiError(stats.error).message} onRetry={() => void stats.refetch()} />;
  const s = stats.data;

  return (
    <>
      <ModuleTabs tabs={LOGISTIQUE_TABS} />
      <PageHeader title="Dashboard logistique" subtitle="Affectation des chauffeurs et suivi des livraisons en un coup d'œil." breadcrumb="Logistique" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="À affecter" value={s.a_affecter} icon={UserCheck} tone="purple" to="/admin/commandes?statut=validee" />
        <KpiCard label="Livraisons en cours" value={s.en_livraison} icon={Truck} tone="gold" to="/admin/commandes?statut=en_livraison" />
        <KpiCard label="Livrées aujourd'hui" value={s.livrees_jour} icon={PackageCheck} tone="green" to="/admin/commandes?statut=livree" />
        <KpiCard label="Livrées (total)" value={s.livrees_total} icon={Route} tone="dark" to="/admin/commandes?statut=livree" />
        <KpiCard label="Chauffeurs en mission" value={s.chauffeurs_en_mission} icon={Truck} tone="purple" to="/admin/chauffeurs" />
        <KpiCard label="Chauffeurs" value={s.chauffeurs} icon={Users} tone="gold" to="/admin/chauffeurs" />
      </div>

      <Card className="mt-6">
        <CardHeader title="Livraisons en cours" subtitle="Rafraîchi automatiquement" action={<Link to="/admin/commandes?statut=en_livraison" className="text-sm font-semibold text-ge7-purple hover:underline">Toutes les livraisons →</Link>} />
        {enCours.isLoading ? (
          <Loading />
        ) : !enCours.data?.data.length ? (
          <p className="text-sm text-ge7-black/50">Aucune livraison en cours.</p>
        ) : (
          <div className="divide-y divide-ge7-black/5">
            {enCours.data.data.map((c) => (
              <Link key={c.id} to={`/admin/commandes/${c.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-ge7-gold-soft/30">
                <div>
                  <p className="font-bold">{c.numero} <span className="font-normal text-ge7-black/50">· {c.client}</span></p>
                  <p className="text-xs text-ge7-black/60">{c.chauffeur ?? "Chauffeur ?"} → {c.quartier}, {c.ville} · {money(c.total)}</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-ge7-black/50">reçue {relative(c.cree_le)}</span>
                  <StatusBadge status={c.statut} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
