import { useQuery } from "@tanstack/react-query";
import { ModuleTabs } from "@/components/ui";
import { LOGISTIQUE_TABS } from "@/app/moduleTabs";
import { ClipboardList, PackageCheck, PackageOpen, Route, Truck, UserCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { getOne, toApiError } from "@/lib/api";
import type { LogisticsStats, Mission } from "@/types";
import { usePaginated } from "@/lib/hooks";
import { datetime, relative } from "@/lib/format";
import { Card, CardHeader, ErrorState, KpiCard, Loading, PageHeader, StatusBadge } from "@/components/ui";

export function LogisticsDashboardPage() {
  const stats = useQuery({ queryKey: ["logistics"], queryFn: () => getOne<LogisticsStats>("/logistics/stats"), refetchInterval: 60_000 });
  const missions = usePaginated<Mission>("missions", "/missions", { status: "AFFECTEE,DEPART,EN_LIVRAISON,ARRIVEE", per_page: 10 });

  if (stats.isLoading) return <Loading />;
  if (stats.error || !stats.data) return <ErrorState message={toApiError(stats.error).message} onRetry={() => void stats.refetch()} />;
  const s = stats.data;

  return (
    <>
      <ModuleTabs tabs={LOGISTIQUE_TABS} />
      <PageHeader title="Dashboard logistique" subtitle="Préparation, affectation, missions et réceptions en un coup d'œil." breadcrumb="Pilotage" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="À préparer" value={s.to_prepare} icon={ClipboardList} tone="gold" to="/preparation" />
        <KpiCard label="Prêtes (à affecter)" value={s.to_assign} icon={UserCheck} tone="purple" to="/commandes?status=PRETE" />
        <KpiCard label="Commandes prêtes" value={s.ready} icon={PackageOpen} tone="dark" to="/commandes?status=PRETE" />
        <KpiCard label="Missions en cours" value={s.in_progress} icon={Truck} tone="purple" to="/missions" />
        <KpiCard label="Livraisons terminées" value={s.completed} icon={PackageCheck} tone="green" to="/livraisons" />
        <KpiCard label="En attente de réception" value={s.awaiting_reception} icon={Route} tone="gold" to="/livraisons?status=LIVREE" />
      </div>

      <Card className="mt-6">
        <CardHeader title="Missions actives" subtitle="Rafraîchi automatiquement" action={<Link to="/suivi" className="text-sm font-semibold text-ge7-purple hover:underline">Ouvrir le suivi GPS →</Link>} />
        {missions.isLoading ? (
          <Loading />
        ) : !missions.data?.data.length ? (
          <p className="text-sm text-ge7-black/50">Aucune mission active.</p>
        ) : (
          <div className="divide-y divide-ge7-black/5">
            {missions.data.data.map((m) => (
              <Link key={m.id} to={`/missions/${m.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-ge7-gold-soft/30">
                <div>
                  <p className="font-bold">{m.number} <span className="font-normal text-ge7-black/50">· {m.order?.number}</span></p>
                  <p className="text-xs text-ge7-black/60">{m.driver?.name} → {m.order?.chantier?.name} · prévu {datetime(m.scheduled_at)}</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {m.last_location && <span className="text-ge7-black/50">GPS {relative(m.last_location.recorded_at)}</span>}
                  <StatusBadge status={m.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
