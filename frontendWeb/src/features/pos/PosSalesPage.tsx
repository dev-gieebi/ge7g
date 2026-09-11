import { useNavigate } from "react-router-dom";
import { ModuleTabs } from "@/components/ui";
import { CAISSE_TABS } from "@/app/moduleTabs";
import type { PosSale } from "@/types";
import { useListState, usePaginated } from "@/lib/hooks";
import { datetime, money } from "@/lib/format";
import { Badge, DataTable, Input, PageHeader, SearchInput, Select, StatusBadge, type Column } from "@/components/ui";

export function PosSalesPage() {
  const navigate = useNavigate();
  const list = useListState({ per_page: 25, sort: "created_at", dir: "desc" });
  const { data, isLoading, errorMessage } = usePaginated<PosSale>("pos-sales", "/pos/sales", list.params);

  const columns: Column<PosSale>[] = [
    { key: "number", header: "N°", sortable: true, render: (s) => <span className="font-semibold">{s.number}</span> },
    { key: "created_at", header: "Date", sortable: true, render: (s) => datetime(s.created_at) },
    { key: "cashier", header: "Caissier", render: (s) => s.cashier?.name },
    { key: "customer", header: "Client", render: (s) => s.customer_name ?? "Comptoir" },
    { key: "method", header: "Paiement", render: (s) => <Badge tone="purple">{s.payment_method.replace("_", " ")}</Badge> },
    { key: "tax", header: "Taxe", render: (s) => (s.tax_type === "AUCUNE" ? "—" : `${s.tax_type} ${(Number(s.tax_rate) * 100).toFixed(0)} %`) },
    { key: "total", header: "Total", align: "right", sortable: true, render: (s) => <span className="font-bold">{money(s.total)}</span> },
    { key: "status", header: "Statut", render: (s) => <StatusBadge status={s.status} /> },
  ];

  return (
    <>
      <ModuleTabs tabs={CAISSE_TABS} />
      <PageHeader title="Historique des ventes" subtitle="Tickets et factures émis en caisse." breadcrumb="Caisse" />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="N° ticket, client…" />
        <Select value={String(list.filters.payment_method ?? "")} onChange={(e) => list.setFilter("payment_method", e.target.value)}>
          <option value="">Tous paiements</option>
          {["ESPECES", "CARTE", "VIREMENT", "MOBILE_MONEY", "AUTRE"].map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
        </Select>
        <Input type="date" value={String(list.filters.from ?? "")} onChange={(e) => list.setFilter("from", e.target.value)} />
        <Input type="date" value={String(list.filters.to ?? "")} onChange={(e) => list.setFilter("to", e.target.value)} />
      </div>
      <DataTable columns={columns} data={data} isLoading={isLoading} error={errorMessage} rowKey={(s) => s.id} onRowClick={(s) => navigate(`/caisse/ventes/${s.id}`)} page={list.page} onPageChange={list.setPage} sort={list.sort} onSortChange={list.setSort} emptyTitle="Aucune vente" />
    </>
  );
}
