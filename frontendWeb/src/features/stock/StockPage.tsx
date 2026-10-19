import { useState } from "react";
import { ModuleTabs } from "@/components/ui";
import { APPRO_TABS } from "@/app/moduleTabs";
import { useSearchParams } from "react-router-dom";
import { ArrowLeftRight, ChevronLeft, ChevronRight, FileSpreadsheet, History, Inbox, Loader2, AlertCircle, Table2 } from "lucide-react";
import { EtatStockTable } from "./EtatStockTable";
import type { Product, StockMovement } from "@/types";
import { api } from "@/lib/api";
import { useListState, usePaginated } from "@/lib/hooks";
import { useProductsRef } from "@/features/shared/refData";
import { datetime, money, qty } from "@/lib/format";
import { stockTone } from "@/features/products/ProductsPage";
import { useAuth } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { Badge, Button, DataTable, Input, PageHeader, SearchInput, Select, type Column } from "@/components/ui";

type Tab = "levels" | "etat" | "movements";

/** N° interne → N° du document imprimé (VNT-2026-00012 → FAC-00012-2026, ACH-… → BC-…). */
const docNumber = (n?: string | null) => {
  if (!n) return "";
  const parts = n.split("-");
  if (parts.length === 3 && parts[0] === "VNT") return `FAC-${parts[2]}-${parts[1]}`;
  if (parts.length === 3 && parts[0] === "ACH") return `BC-${parts[2]}-${parts[1]}`;
  return n;
};

export function StockPage() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  // Suivi des mouvements (entrées/sorties, factures, BL) : Direction et CDG uniquement.
  const canSeeMovements = hasRole(user, "DG_ADMIN", "CDG_ADMIN");
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

  const mvRows = mv.data?.data ?? [];
  const mvMeta = mv.data?.meta;
  const totals = mvMeta?.totals;
  const [exporting, setExporting] = useState(false);

  const exportXlsx = async () => {
    setExporting(true);
    try {
      const { data } = await api.get<Blob>("/stock-movements/export", {
        params: { ...movements.params, page: undefined, per_page: undefined, sort: undefined, dir: undefined },
        responseType: "blob",
      });
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `suivi-stock${movements.filters.month ? `-${movements.filters.month}` : ""}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <ModuleTabs tabs={APPRO_TABS} />
      <PageHeader
        title="Stock central"
        subtitle="Niveaux, réservations et historique des mouvements. Le stock est alimenté par la réception des achats."
        breadcrumb="Approvisionnement"
      />
      {canSeeMovements && (
        <div className="mb-4 flex gap-2">
          {([["levels", "Niveaux de stock", ArrowLeftRight], ["etat", "État du stock", Table2], ["movements", "Mouvements", History]] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${tab === k ? "bg-ge7-black text-ge7-gold-light" : "bg-white text-ge7-black/70 hover:bg-ge7-gold-soft/50"}`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      )}

      {tab === "etat" && canSeeMovements ? (
        <EtatStockTable />
      ) : !canSeeMovements || tab === "levels" ? (
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
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <Select value={String(movements.filters.product_id ?? "")} onChange={(e) => movements.setFilter("product_id", e.target.value)}>
              <option value="">Tous les produits</option>
              {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Select value={String(movements.filters.type ?? "")} onChange={(e) => movements.setFilter("type", e.target.value)}>
              <option value="">Tous les types</option>
              {["ENTREE", "SORTIE", "AJUSTEMENT", "RESERVATION", "LIVRAISON", "TRANSFERT", "VENTE"].map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <SearchInput value={movements.search} onChange={movements.setSearch} placeholder="Produit, référence, N° document…" />
            <Input type="month" value={String(movements.filters.month ?? "")} onChange={(e) => movements.setFilter("month", e.target.value)} title="Filtrer par mois" />
          </div>
          <div className="mb-4 flex justify-end">
            <Button variant="purple" size="sm" loading={exporting} onClick={() => void exportXlsx()}>
              <FileSpreadsheet size={15} /> Exporter Excel
            </Button>
          </div>

          {totals && (
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Entrées du mois</p>
                <p className="mt-1 text-lg font-extrabold text-emerald-800">{qty(totals.entries.quantity)} <span className="text-sm font-semibold">· {money(totals.entries.amount)}</span></p>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-rose-700">Sorties du mois</p>
                <p className="mt-1 text-lg font-extrabold text-rose-800">{qty(totals.exits.quantity)} <span className="text-sm font-semibold">· {money(totals.exits.amount)}</span></p>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-3xl border border-ge7-black/5 bg-white shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1500px] border-collapse text-[11px]">
                <thead>
                  <tr>
                    <th colSpan={19} className="border border-ge7-black/40 bg-white px-2 py-2 text-center text-sm font-extrabold uppercase tracking-widest">Suivi stock</th>
                  </tr>
                  <tr className="bg-ge7-black/[0.04]">
                    <th colSpan={9} className="border border-ge7-black/40 px-2 py-1.5 text-center font-bold uppercase">Base de données</th>
                    <th colSpan={2} className="border border-ge7-black/40 px-2 py-1.5 text-center font-bold uppercase">Entrées</th>
                    <th colSpan={3} className="border border-ge7-black/40 px-2 py-1.5 text-center font-bold uppercase">Sorties</th>
                    <th rowSpan={2} className="border border-ge7-black/40 px-2 py-1.5 text-center font-bold uppercase">N° BL</th>
                    <th colSpan={2} className="border border-ge7-black/40 px-2 py-1.5 text-center font-bold uppercase">Entrées Mois</th>
                    <th colSpan={2} className="border border-ge7-black/40 px-2 py-1.5 text-center font-bold uppercase">Sorties Mois</th>
                  </tr>
                  <tr className="bg-ge7-black/[0.04]">
                    {["REF", "DATE", "DÉSIGNATION", "FOURNISSEUR", "INITIATEUR", "CLIENT", "N° FACTURE", "UNITÉ", "P.U", "QUANTITÉ", "MONTANT", "QUANTITÉ", "MONTANT", "CLIENT", "QUANTITÉ", "MONTANT", "QUANTITÉ", "MONTANT"].map((h, i) => (
                      <th key={i} className="whitespace-nowrap border border-ge7-black/40 px-1.5 py-1.5 text-center font-bold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mv.isLoading ? (
                    <tr><td colSpan={19} className="border border-ge7-black/20 px-4 py-14 text-center text-ge7-black/50"><Loader2 className="mx-auto mb-2 animate-spin text-ge7-gold" />Chargement…</td></tr>
                  ) : mv.errorMessage ? (
                    <tr><td colSpan={19} className="border border-ge7-black/20 px-4 py-14 text-center text-rose-600"><AlertCircle className="mx-auto mb-2" />{mv.errorMessage}</td></tr>
                  ) : mvRows.length === 0 ? (
                    <tr><td colSpan={19} className="border border-ge7-black/20 px-4 py-14 text-center text-ge7-black/50"><Inbox className="mx-auto mb-2 text-ge7-gold" /><p className="font-semibold text-ge7-black/70">Aucun mouvement</p></td></tr>
                  ) : (
                    mvRows.map((m: StockMovement) => {
                      const isIn = Number(m.quantity) >= 0;
                      const isPurchase = m.reference_type === "Purchase";
                      const isSale = m.reference_type === "PosSale";
                      const cell = "border border-ge7-black/30 px-1.5 py-1";
                      const num = `${cell} text-right whitespace-nowrap`;
                      return (
                        <tr key={m.id} className="transition hover:bg-ge7-gold-soft/30">
                          <td className={`${cell} font-mono font-bold whitespace-nowrap`}>{m.product?.reference ?? ""}</td>
                          <td className={`${cell} whitespace-nowrap`}>{datetime(m.created_at)}</td>
                          <td className={cell}><span className="font-semibold">{m.product?.name}</span>{m.product?.type ? <span className="text-ge7-black/50"> · {m.product.type}</span> : null}</td>
                          <td className={cell}>{isPurchase ? m.party_name ?? "" : ""}</td>
                          <td className={`${cell} whitespace-nowrap`}>{m.user?.name ?? "Système"}</td>
                          <td className={cell}>{isSale ? m.party_name ?? "" : ""}</td>
                          <td className={`${cell} whitespace-nowrap`}>{docNumber(m.invoice_number)}</td>
                          <td className={`${cell} text-center`}>{m.product?.unit?.symbol ?? ""}</td>
                          <td className={num}>{m.unit_price != null ? money(m.unit_price) : ""}</td>
                          <td className={`${num} font-semibold text-emerald-700`}>{isIn ? qty(m.quantity) : ""}</td>
                          <td className={`${num} text-emerald-700`}>{isIn && m.amount != null ? money(m.amount) : ""}</td>
                          <td className={`${num} font-semibold text-rose-600`}>{!isIn ? qty(Math.abs(m.quantity)) : ""}</td>
                          <td className={`${num} text-rose-600`}>{!isIn && m.amount != null ? money(m.amount) : ""}</td>
                          <td className={cell}>{!isIn && isSale ? m.party_name ?? "" : ""}</td>
                          <td className={`${cell} whitespace-nowrap`}>{docNumber(m.bl_number)}</td>
                          <td className={`${num} font-semibold`}>{qty(m.month_entries_quantity)}</td>
                          <td className={num}>{m.month_entries_amount != null ? money(m.month_entries_amount) : ""}</td>
                          <td className={`${num} font-semibold`}>{qty(m.month_exits_quantity)}</td>
                          <td className={num}>{m.month_exits_amount != null ? money(m.month_exits_amount) : ""}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {mvMeta && mvMeta.last_page > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ge7-black/5 px-4 py-3 text-sm text-ge7-black/60">
                <span>{mvMeta.from ?? 0}–{mvMeta.to ?? 0} sur {mvMeta.total}</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" disabled={mvMeta.current_page <= 1} onClick={() => movements.setPage(mvMeta.current_page - 1)}>
                    <ChevronLeft size={14} /> Précédent
                  </Button>
                  <span className="px-2 font-semibold text-ge7-black">{mvMeta.current_page} / {mvMeta.last_page}</span>
                  <Button size="sm" variant="secondary" disabled={mvMeta.current_page >= mvMeta.last_page} onClick={() => movements.setPage(mvMeta.current_page + 1)}>
                    Suivant <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
