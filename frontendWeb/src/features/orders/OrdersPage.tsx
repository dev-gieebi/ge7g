import { useNavigate, useSearchParams } from "react-router-dom";
import { ModuleTabs } from "@/components/ui";
import { COMMERCIAL_TABS } from "@/app/moduleTabs";
import type { Order, OrderStatus } from "@/types";
import { useListState, usePaginated } from "@/lib/hooks";
import { useClientsRef, useDriversRef, useZones } from "@/features/shared/refData";
import { date, money } from "@/lib/format";
import { DataTable, Input, PageHeader, SearchInput, Select, StatusBadge, type Column } from "@/components/ui";

export const ORDER_STATUSES: OrderStatus[] = [
  "BROUILLON", "EN_ATTENTE", "VALIDEE", "EN_PREPARATION", "PRETE", "EN_LIVRAISON",
  "PARTIELLEMENT_LIVREE", "LIVREE", "RECEPTION_CONFIRMEE", "CLOTUREE", "REFUSEE", "ANNULEE",
];

export function OrdersPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const list = useListState({ per_page: 20, status: params.get("status") ?? undefined });
  const { data, isLoading, errorMessage } = usePaginated<Order>("orders", "/orders", list.params);
  const { data: clients } = useClientsRef();
  const { data: zones } = useZones();
  const { data: drivers } = useDriversRef();

  const columns: Column<Order>[] = [
    { key: "number", header: "N°", sortable: true, render: (o) => <span className="font-semibold">{o.number}</span> },
    { key: "client", header: "Client", render: (o) => o.client?.company_name },
    { key: "chantier", header: "Chantier", render: (o) => o.chantier?.name },
    { key: "created_at", header: "Date", sortable: true, render: (o) => date(o.created_at) },
    { key: "requested_date", header: "Souhaitée", render: (o) => date(o.requested_date) },
    { key: "driver", header: "Chauffeur", render: (o) => o.mission?.driver?.name ?? "—" },
    { key: "total", header: "Total", align: "right", sortable: true, render: (o) => <span className="font-semibold">{money(o.total)}</span> },
    { key: "status", header: "Statut", render: (o) => <StatusBadge status={o.status} /> },
  ];

  return (
    <>
      <ModuleTabs tabs={COMMERCIAL_TABS} />
      <PageHeader title="Commandes clients" subtitle="Suivi de toutes les commandes, de la demande à la clôture." breadcrumb="Commercial" />
      <div className="mb-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="N° commande…" />
        <Select value={String(list.filters.client_id ?? "")} onChange={(e) => list.setFilter("client_id", e.target.value)}>
          <option value="">Tous les clients</option>
          {clients?.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </Select>
        <Select value={String(list.filters.status ?? list.params.status ?? "")} onChange={(e) => list.setFilter("status", e.target.value)}>
          <option value="">Tous les statuts</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </Select>
        <Select value={String(list.filters.zone_id ?? "")} onChange={(e) => list.setFilter("zone_id", e.target.value)}>
          <option value="">Toutes les zones</option>
          {zones?.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </Select>
        <Select value={String(list.filters.driver_id ?? "")} onChange={(e) => list.setFilter("driver_id", e.target.value)}>
          <option value="">Tous les chauffeurs</option>
          {drivers?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
        <Input type="date" value={String(list.filters.date ?? "")} onChange={(e) => list.setFilter("date", e.target.value)} />
      </div>
      <DataTable columns={columns} data={data} isLoading={isLoading} error={errorMessage} rowKey={(o) => o.id} onRowClick={(o) => navigate(`/commandes/${o.id}`)} page={list.page} onPageChange={list.setPage} sort={list.sort} onSortChange={list.setSort} emptyTitle="Aucune commande" />
    </>
  );
}
