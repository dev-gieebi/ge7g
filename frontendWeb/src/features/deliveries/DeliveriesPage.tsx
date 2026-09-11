import { useNavigate, useSearchParams } from "react-router-dom";
import { ModuleTabs } from "@/components/ui";
import { LOGISTIQUE_TABS } from "@/app/moduleTabs";
import type { Delivery } from "@/types";
import { useListState, usePaginated } from "@/lib/hooks";
import { useClientsRef, useDriversRef } from "@/features/shared/refData";
import { datetime } from "@/lib/format";
import { Badge, DataTable, PageHeader, SearchInput, Select, StatusBadge, type Column } from "@/components/ui";

export function DeliveriesPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const list = useListState({ per_page: 20, status: params.get("status") ?? undefined });
  const { data, isLoading, errorMessage } = usePaginated<Delivery>("deliveries", "/deliveries", list.params);
  const { data: clients } = useClientsRef();
  const { data: drivers } = useDriversRef();

  const columns: Column<Delivery>[] = [
    { key: "mission", header: "Mission", render: (d) => <span className="font-semibold">{d.mission?.number}</span> },
    { key: "order", header: "Commande", render: (d) => d.order?.number },
    { key: "client", header: "Client / chantier", render: (d) => <div><p>{d.order?.client?.company_name}</p><p className="text-xs text-ge7-black/50">{d.chantier?.name}</p></div> },
    { key: "driver", header: "Chauffeur", render: (d) => d.mission?.driver?.name },
    { key: "delivered_at", header: "Livré le", sortable: true, render: (d) => datetime(d.delivered_at) },
    { key: "partial", header: "Type", render: (d) => (d.is_partial ? <Badge tone="amber">Partielle</Badge> : <Badge tone="green">Complète</Badge>) },
    { key: "signatures", header: "Signatures", render: (d) => <span className="text-xs">{d.signatures?.length ?? 0} / 2</span> },
    { key: "status", header: "Statut", render: (d) => <StatusBadge status={d.status} /> },
  ];

  return (
    <>
      <ModuleTabs tabs={LOGISTIQUE_TABS} />
      <PageHeader title="Livraisons" subtitle="Preuves de livraison : quantités, GPS, signatures client et chauffeur." breadcrumb="Opérations" />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="Mission, commande…" />
        <Select value={String(list.filters.client_id ?? "")} onChange={(e) => list.setFilter("client_id", e.target.value)}>
          <option value="">Tous les clients</option>
          {clients?.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </Select>
        <Select value={String(list.filters.driver_id ?? "")} onChange={(e) => list.setFilter("driver_id", e.target.value)}>
          <option value="">Tous les chauffeurs</option>
          {drivers?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
        <Select value={String(list.filters.status ?? list.params.status ?? "")} onChange={(e) => list.setFilter("status", e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="LIVREE">Livrée (réception en attente)</option>
          <option value="RECEPTION_CONFIRMEE">Réception confirmée</option>
        </Select>
      </div>
      <DataTable columns={columns} data={data} isLoading={isLoading} error={errorMessage} rowKey={(d) => d.id} onRowClick={(d) => navigate(`/livraisons/${d.id}`)} page={list.page} onPageChange={list.setPage} sort={list.sort} onSortChange={list.setSort} emptyTitle="Aucune livraison" />
    </>
  );
}
