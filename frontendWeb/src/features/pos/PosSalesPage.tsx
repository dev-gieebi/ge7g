import { useNavigate } from "react-router-dom";
import type { PosSale } from "@/types";
import { useListState, usePaginated } from "@/lib/hooks";
import { useZones } from "@/features/shared/refData";
import { datetime, money, numeroDocument } from "@/lib/format";
import { Badge, CardGrid, Input, PageHeader, SearchInput, Select, StatusBadge } from "@/components/ui";

export function PosSalesPage() {
  const navigate = useNavigate();
  const list = useListState({ per_page: 25, sort: "created_at", dir: "desc" });
  const { data, isLoading, errorMessage } = usePaginated<PosSale>("pos-sales", "/pos/sales", list.params);
  const { data: zones } = useZones();

  return (
    <>
      <PageHeader title="Historique des ventes" subtitle="Tickets de caisse et ventes de la boutique en ligne." breadcrumb="Caisse" />
      <div className="mb-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="N° ticket, client…" />
        <Select value={String(list.filters.source ?? "")} onChange={(e) => list.setFilter("source", e.target.value)}>
          <option value="">Toutes sources</option>
          <option value="caisse">Caisse</option>
          <option value="boutique_en_ligne">Boutique en ligne</option>
        </Select>
        <Select value={String(list.filters.payment_method ?? "")} onChange={(e) => list.setFilter("payment_method", e.target.value)}>
          <option value="">Tous paiements</option>
          {["ESPECES", "CARTE", "CHEQUE", "VIREMENT", "MOBILE_MONEY", "AUTRE"].map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
        </Select>
        <Select value={String(list.filters.zone_id ?? "")} onChange={(e) => list.setFilter("zone_id", e.target.value)}>
          <option value="">Toutes villes</option>
          {zones?.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </Select>
        <Input type="date" value={String(list.filters.from ?? "")} onChange={(e) => list.setFilter("from", e.target.value)} />
        <Input type="date" value={String(list.filters.to ?? "")} onChange={(e) => list.setFilter("to", e.target.value)} />
      </div>
      <CardGrid
        sansImage
        data={data}
        isLoading={isLoading}
        error={errorMessage}
        rowKey={(s) => s.id}
        onCardClick={(s) => navigate(`/admin/caisse/ventes/${s.id}`)}
        page={list.page}
        onPageChange={list.setPage}
        emptyTitle="Aucune vente"
        carte={(s) => ({
          badge: s.annulee ? <Badge tone="red">Annulée</Badge> : <StatusBadge status={s.status} />,
          titre: numeroDocument(s.number),
          sousTitre: s.customer_name ?? "Comptoir",
          details: [
            { label: "Date", valeur: datetime(s.created_at) },
            { label: "Caissier", valeur: s.cashier?.name ?? "" },
            { label: "Ville", valeur: s.zone?.name ?? "Comptoir" },
            ...(s.tax_type === "AUCUNE" ? [] : [{ label: "Taxe", valeur: `${s.tax_type} ${(Number(s.tax_rate) * 100).toFixed(0)} %` }]),
            { label: "Livraison", valeur: <StatusBadge status={s.delivery_status} /> },
          ],
          pied: (
            <>
              <Badge tone={s.source === "boutique_en_ligne" ? "blue" : "gray"}>{s.source === "boutique_en_ligne" ? "Boutique en ligne" : "Caisse"}</Badge>
              <Badge tone="purple">{s.payment_method.replace("_", " ")}</Badge>
            </>
          ),
          valeur: money(s.total),
        })}
      />
    </>
  );
}
