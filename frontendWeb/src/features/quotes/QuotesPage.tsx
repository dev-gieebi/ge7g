import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { ModuleTabs } from "@/components/ui";
import { DEVIS_TABS } from "@/app/moduleTabs";
import type { Quote } from "@/types";
import { useListState, usePaginated } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { datetime, money } from "@/lib/format";
import { Button, DataTable, Input, PageHeader, SearchInput, Select, StatusBadge, type Column } from "@/components/ui";

/** « DEV-2026-00012 » → « DEV-00012-2026 » (même présentation que les factures). */
const displayNumber = (n: string) => {
  const parts = n.split("-");
  return parts.length === 3 ? `DEV-${parts[2]}-${parts[1]}` : n;
};

export function QuotesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate = hasRole(user, "CDG_ADMIN", "LG_ADMIN", "DG_ADMIN");
  const list = useListState({ per_page: 25, sort: "created_at", dir: "desc" });
  const { data, isLoading, errorMessage } = usePaginated<Quote>("quotes", "/quotes", list.params);

  const columns: Column<Quote>[] = [
    { key: "number", header: "N°", sortable: true, render: (q) => <span className="font-semibold">{displayNumber(q.number)}</span> },
    { key: "created_at", header: "Date", sortable: true, render: (q) => datetime(q.created_at) },
    { key: "creator", header: "Émetteur", render: (q) => q.creator?.name },
    { key: "customer", header: "Client", render: (q) => q.customer_name },
    { key: "total", header: "Total", align: "right", sortable: true, render: (q) => <span className="font-bold">{money(q.total)}</span> },
    { key: "status", header: "Statut", render: (q) => <StatusBadge status={q.status} /> },
  ];

  return (
    <>
      <ModuleTabs tabs={DEVIS_TABS} />
      <PageHeader
        title="Devis"
        subtitle="Propositions commerciales établies pour les clients."
        breadcrumb="Commercial"
        action={canCreate ? <Button onClick={() => navigate("/admin/devis/nouveau")}><Plus size={15} /> Nouveau devis</Button> : undefined}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="N° devis, client…" />
        <Select value={String(list.filters.status ?? "")} onChange={(e) => list.setFilter("status", e.target.value)}>
          <option value="">Tous statuts</option>
          <option value="BROUILLON">Brouillon</option>
          <option value="ENVOYE">Envoyé</option>
          <option value="VALIDE">Validé</option>
          <option value="ANNULE">Annulé</option>
        </Select>
        <Input type="date" value={String(list.filters.from ?? "")} onChange={(e) => list.setFilter("from", e.target.value)} />
        <Input type="date" value={String(list.filters.to ?? "")} onChange={(e) => list.setFilter("to", e.target.value)} />
      </div>
      <DataTable columns={columns} data={data} isLoading={isLoading} error={errorMessage} rowKey={(q) => q.id} onRowClick={(q) => navigate(`/admin/devis/${q.id}`)} page={list.page} onPageChange={list.setPage} sort={list.sort} onSortChange={list.setSort} emptyTitle="Aucun devis" />
    </>
  );
}
