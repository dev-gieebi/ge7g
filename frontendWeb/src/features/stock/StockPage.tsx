import { useState } from "react";
import { ModuleTabs } from "@/components/ui";
import { APPRO_TABS } from "@/app/moduleTabs";
import { useSearchParams } from "react-router-dom";
import { ArrowLeftRight, History } from "lucide-react";
import type { Product, StockMovement } from "@/types";
import { useListState, usePaginated } from "@/lib/hooks";
import { useProductsRef } from "@/features/shared/refData";
import { datetime, qty } from "@/lib/format";
import { stockTone } from "@/features/products/ProductsPage";
import { Badge, DataTable, PageHeader, SearchInput, Select, StatusBadge, type Column } from "@/components/ui";

type Tab = "levels" | "movements";

export function StockPage() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>("levels");
  const levels = useListState({ per_page: 20, alert: params.get("alert") ?? undefined });
  const movements = useListState({ per_page: 25 });
  const lv = usePaginated<Product>("products", "/stocks", levels.params, tab === "levels");
  const mv = usePaginated<StockMovement>("stock-movements", "/stock-movements", movements.params, tab === "movements");
  const { data: products } = useProductsRef();

  const levelCols: Column<Product>[] = [
    { key: "name", header: "Produit", sortable: true, render: (p) => <div><p className="font-semibold">{p.name}</p><p className="text-xs text-ge7-black/50">{p.reference}</p></div> },
    { key: "stock_quantity", header: "Stock actuel", align: "right", sortable: true, render: (p) => qty(p.stock_quantity, p.unit?.symbol) },
    { key: "reserved_quantity", header: "Réservé", align: "right", render: (p) => <span className="text-ge7-purple">{qty(p.reserved_quantity, p.unit?.symbol)}</span> },
    { key: "available_quantity", header: "Disponible", align: "right", render: (p) => <span className="font-bold">{qty(p.available_quantity, p.unit?.symbol)}</span> },
    { key: "min_stock", header: "Stock min.", align: "right", render: (p) => qty(p.min_stock, p.unit?.symbol) },
    { key: "state", header: "État", render: (p) => { const s = stockTone(p); return <Badge tone={s.tone}>{s.label}</Badge>; } },
  ];

  const mvCols: Column<StockMovement>[] = [
    { key: "created_at", header: "Date", sortable: true, render: (m) => datetime(m.created_at) },
    { key: "product", header: "Produit", render: (m) => <span className="font-semibold">{m.product?.name}</span> },
    { key: "type", header: "Type", render: (m) => <StatusBadge status={m.type} /> },
    { key: "quantity", header: "Quantité", align: "right", render: (m) => <span className={`font-bold ${m.quantity >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{m.quantity > 0 ? "+" : ""}{qty(m.quantity, m.product?.unit?.symbol)}</span> },
    { key: "balance_after", header: "Solde", align: "right", render: (m) => qty(m.balance_after, m.product?.unit?.symbol) },
    { key: "reference", header: "Référence", render: (m) => m.reference_number ?? "—" },
    { key: "user", header: "Par", render: (m) => m.user?.name ?? "Système" },
    { key: "note", header: "Note", render: (m) => <span className="text-ge7-black/60">{m.note ?? ""}</span> },
  ];

  return (
    <>
      <ModuleTabs tabs={APPRO_TABS} />
      <PageHeader
        title="Stock central"
        subtitle="Niveaux, réservations et historique des mouvements. Le stock est alimenté par la réception des achats."
        breadcrumb="Approvisionnement"
      />
      <div className="mb-4 flex gap-2">
        {([["levels", "Niveaux de stock", ArrowLeftRight], ["movements", "Mouvements", History]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${tab === k ? "bg-ge7-black text-ge7-gold-light" : "bg-white text-ge7-black/70 hover:bg-ge7-gold-soft/50"}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === "levels" ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <SearchInput value={levels.search} onChange={levels.setSearch} placeholder="Produit, référence…" className="sm:col-span-2" />
            <Select value={String(levels.filters.alert ?? levels.params.alert ?? "")} onChange={(e) => levels.setFilter("alert", e.target.value)}>
              <option value="">Tous</option>
              <option value="low">Stock faible</option>
              <option value="out">Rupture</option>
            </Select>
          </div>
          <DataTable columns={levelCols} data={lv.data} isLoading={lv.isLoading} error={lv.errorMessage} rowKey={(p) => p.id} page={levels.page} onPageChange={levels.setPage} sort={levels.sort} onSortChange={levels.setSort} />
        </>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Select value={String(movements.filters.product_id ?? "")} onChange={(e) => movements.setFilter("product_id", e.target.value)}>
              <option value="">Tous les produits</option>
              {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Select value={String(movements.filters.type ?? "")} onChange={(e) => movements.setFilter("type", e.target.value)}>
              <option value="">Tous les types</option>
              {["ENTREE", "SORTIE", "AJUSTEMENT", "RESERVATION", "LIVRAISON", "TRANSFERT", "VENTE"].map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
          <DataTable columns={mvCols} data={mv.data} isLoading={mv.isLoading} error={mv.errorMessage} rowKey={(m) => m.id} page={movements.page} onPageChange={movements.setPage} sort={movements.sort} onSortChange={movements.setSort} dense />
        </>
      )}
    </>
  );
}
