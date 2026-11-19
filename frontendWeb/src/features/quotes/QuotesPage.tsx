import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { ModuleTabs } from "@/components/ui";
import { DEVIS_TABS } from "@/app/moduleTabs";
import { numeroProforma } from "./numero";
import type { Quote } from "@/types";
import { useListState, usePaginated } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { datetime, money } from "@/lib/format";
import { Button, CardGrid, Input, PageHeader, SearchInput, Select, StatusBadge } from "@/components/ui";


export function QuotesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate = hasRole(user, "CDG_ADMIN", "LG_ADMIN", "DG_ADMIN");
  const list = useListState({ per_page: 25, sort: "created_at", dir: "desc" });
  const { data, isLoading, errorMessage } = usePaginated<Quote>("quotes", "/quotes", list.params);

  return (
    <>
      <ModuleTabs tabs={DEVIS_TABS} />
      <PageHeader
        title="Proformas"
        subtitle="Propositions commerciales établies pour les clients."
        breadcrumb="Commercial"
        action={canCreate ? <Button onClick={() => navigate("/admin/devis/nouveau")}><Plus size={15} /> Nouvelle proforma</Button> : undefined}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="N° proforma, client…" />
        <Select value={String(list.filters.status ?? "")} onChange={(e) => list.setFilter("status", e.target.value)}>
          <option value="">Tous statuts</option>
          <option value="BROUILLON">Brouillon</option>
          <option value="VALIDE">Validé</option>
          <option value="ENVOYE">Envoyé</option>
          <option value="ANNULE">Annulé</option>
        </Select>
        <Input type="date" value={String(list.filters.from ?? "")} onChange={(e) => list.setFilter("from", e.target.value)} />
        <Input type="date" value={String(list.filters.to ?? "")} onChange={(e) => list.setFilter("to", e.target.value)} />
      </div>
      <CardGrid
        sansImage
        data={data}
        isLoading={isLoading}
        error={errorMessage}
        rowKey={(q) => q.id}
        onCardClick={(q) => navigate(`/admin/devis/${q.id}`)}
        page={list.page}
        onPageChange={list.setPage}
        emptyTitle="Aucune proforma"
        carte={(q) => ({
          badge: <StatusBadge status={q.status} />,
          titre: numeroProforma(q.number),
          sousTitre: q.customer_name,
          details: [
            { label: "Date", valeur: datetime(q.created_at) },
            { label: "Émetteur", valeur: q.creator?.name ?? "" },
          ],
          valeur: money(q.total),
        })}
      />
    </>
  );
}
