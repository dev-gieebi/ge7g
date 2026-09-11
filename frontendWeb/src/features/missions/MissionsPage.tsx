import { useNavigate } from "react-router-dom";
import { ModuleTabs } from "@/components/ui";
import { LOGISTIQUE_TABS } from "@/app/moduleTabs";
import type { Mission, MissionStatus } from "@/types";
import { useListState, usePaginated } from "@/lib/hooks";
import { useDriversRef } from "@/features/shared/refData";
import { datetime, relative } from "@/lib/format";
import { DataTable, PageHeader, SearchInput, Select, StatusBadge, type Column } from "@/components/ui";

export const MISSION_STATUSES: MissionStatus[] = ["AFFECTEE", "DEPART", "EN_LIVRAISON", "ARRIVEE", "LIVREE", "TERMINEE", "ANNULEE"];

export function MissionsPage() {
  const navigate = useNavigate();
  const list = useListState({ per_page: 20, sort: "scheduled_at", dir: "desc" });
  const { data, isLoading, errorMessage } = usePaginated<Mission>("missions", "/missions", list.params);
  const { data: drivers } = useDriversRef();

  const columns: Column<Mission>[] = [
    { key: "number", header: "Mission", sortable: true, render: (m) => <span className="font-semibold">{m.number}</span> },
    { key: "order", header: "Commande", render: (m) => m.order?.number },
    { key: "client", header: "Client / chantier", render: (m) => <div><p>{m.order?.client?.company_name}</p><p className="text-xs text-ge7-black/50">{m.order?.chantier?.name}</p></div> },
    { key: "driver", header: "Chauffeur", render: (m) => m.driver?.name },
    { key: "vehicle", header: "Véhicule", render: (m) => m.vehicle?.plate ?? "—" },
    { key: "scheduled_at", header: "Prévu", sortable: true, render: (m) => datetime(m.scheduled_at) },
    { key: "gps", header: "Dernier GPS", render: (m) => (m.last_location ? <span className="text-xs text-ge7-black/60">{relative(m.last_location.recorded_at)}</span> : "—") },
    { key: "status", header: "Statut", render: (m) => <StatusBadge status={m.status} /> },
  ];

  return (
    <>
      <ModuleTabs tabs={LOGISTIQUE_TABS} />
      <PageHeader title="Missions" subtitle="Affectations chauffeur / véhicule et avancement des livraisons." breadcrumb="Opérations" />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="N° mission, commande…" />
        <Select value={String(list.filters.status ?? "")} onChange={(e) => list.setFilter("status", e.target.value)}>
          <option value="">Tous les statuts</option>
          {MISSION_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </Select>
        <Select value={String(list.filters.driver_id ?? "")} onChange={(e) => list.setFilter("driver_id", e.target.value)}>
          <option value="">Tous les chauffeurs</option>
          {drivers?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
      </div>
      <DataTable columns={columns} data={data} isLoading={isLoading} error={errorMessage} rowKey={(m) => m.id} onRowClick={(m) => navigate(`/missions/${m.id}`)} page={list.page} onPageChange={list.setPage} sort={list.sort} onSortChange={list.setSort} emptyTitle="Aucune mission" />
    </>
  );
}
