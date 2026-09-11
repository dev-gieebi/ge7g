import { useNavigate } from "react-router-dom";
import { ModuleTabs } from "@/components/ui";
import { COMMERCIAL_TABS } from "@/app/moduleTabs";
import type { Invoice } from "@/types";
import { useListState, usePaginated } from "@/lib/hooks";
import { useClientsRef } from "@/features/shared/refData";
import { date, money } from "@/lib/format";
import { Badge, DataTable, Input, PageHeader, SearchInput, Select, StatusBadge, type Column } from "@/components/ui";

export function InvoicesPage() {
  const navigate = useNavigate();
  const list = useListState({ per_page: 20, sort: "date", dir: "desc" });
  const { data, isLoading, errorMessage } = usePaginated<Invoice>("invoices", "/invoices", list.params);
  const { data: clients } = useClientsRef();

  const columns: Column<Invoice>[] = [
    { key: "number", header: "N°", sortable: true, render: (i) => <span className="font-semibold">{i.number}</span> },
    { key: "type", header: "Type", render: (i) => <Badge tone={i.type === "AVOIR" ? "red" : i.type === "TICKET" ? "gray" : "gold"}>{i.type}</Badge> },
    { key: "date", header: "Date", sortable: true, render: (i) => date(i.date) },
    { key: "client", header: "Client", render: (i) => i.client?.company_name ?? "Comptoir" },
    { key: "chantier", header: "Chantier", render: (i) => i.chantier?.name ?? "—" },
    { key: "tax", header: "Taxe", render: (i) => (i.tax_type === "AUCUNE" ? "—" : `${i.tax_type} ${(Number(i.tax_rate) * 100).toFixed(0)} %`) },
    { key: "total", header: "Total", align: "right", sortable: true, render: (i) => <span className="font-bold">{money(i.total)}</span> },
    { key: "paid", header: "Payé", align: "right", render: (i) => money(i.paid_amount) },
    { key: "status", header: "Statut", render: (i) => <StatusBadge status={i.status} /> },
  ];

  return (
    <>
      <ModuleTabs tabs={COMMERCIAL_TABS} />
      <PageHeader title="Factures" subtitle="Factures, avoirs et tickets. Chaque document conserve son taux de taxe historique." breadcrumb="Commercial" />
      <div className="mb-4 grid gap-3 sm:grid-cols-5">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="N° facture…" />
        <Select value={String(list.filters.client_id ?? "")} onChange={(e) => list.setFilter("client_id", e.target.value)}>
          <option value="">Tous les clients</option>
          {clients?.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </Select>
        <Select value={String(list.filters.status ?? "")} onChange={(e) => list.setFilter("status", e.target.value)}>
          <option value="">Tous les statuts</option>
          {["EMISE", "PARTIELLEMENT_PAYEE", "PAYEE", "ANNULEE"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </Select>
        <Input type="date" value={String(list.filters.from ?? "")} onChange={(e) => list.setFilter("from", e.target.value)} />
        <Input type="date" value={String(list.filters.to ?? "")} onChange={(e) => list.setFilter("to", e.target.value)} />
      </div>
      <DataTable columns={columns} data={data} isLoading={isLoading} error={errorMessage} rowKey={(i) => i.id} onRowClick={(i) => navigate(`/factures/${i.id}`)} page={list.page} onPageChange={list.setPage} sort={list.sort} onSortChange={list.setSort} emptyTitle="Aucune facture" />
    </>
  );
}
