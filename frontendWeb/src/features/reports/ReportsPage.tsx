import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FileSpreadsheet } from "lucide-react";
import { api, toApiError } from "@/lib/api";
import type { SalesReport } from "@/types";
import { money, qty } from "@/lib/format";
import { Button, Card, CardHeader, ErrorState, Input, Loading, PageHeader } from "@/components/ui";
import { PilotageSection } from "./PilotageSection";

// Semaine écoulée par défaut : lundi → dimanche derniers (rapport du lundi, procédure §6).
const lastWeek = (): { from: string; to: string } => {
  const now = new Date();
  const f = (d: Date) => d.toISOString().slice(0, 10);
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) - 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: f(monday), to: f(sunday) };
};

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className="!p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ge7-black/50">{label}</p>
      <p className={`mt-1 text-xl font-extrabold ${accent ? "text-ge7-bronze" : ""}`}>{value}</p>
    </Card>
  );
}

function ReportTables({ r }: { r: SalesReport }) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader title="Ventes par client" />
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-ge7-black/10 text-left text-xs uppercase text-ge7-black/50">
              <th className="py-1.5">Client</th>
              <th className="py-1.5 text-center">Factures</th>
              <th className="py-1.5 text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            {r.by_customer.map((c) => (
              <tr key={c.customer} className="border-b border-ge7-black/5">
                <td className="py-2 font-semibold">{c.customer}</td>
                <td className="py-2 text-center">{c.sales_count}</td>
                <td className="py-2 text-right font-bold">{money(c.total)}</td>
              </tr>
            ))}
            {r.by_customer.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-ge7-black/50">Aucune vente</td></tr>}
          </tbody>
        </table>
      </Card>
      <Card>
        <CardHeader title="Ventes par produit" />
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-ge7-black/10 text-left text-xs uppercase text-ge7-black/50">
              <th className="py-1.5">Produit</th>
              <th className="py-1.5 text-center">Facturé</th>
              <th className="py-1.5 text-center">Livré</th>
              <th className="py-1.5 text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            {r.by_product.map((p) => (
              <tr key={p.product_id} className="border-b border-ge7-black/5">
                <td className="py-2 font-semibold">{p.name}{p.type ? <span className="text-ge7-black/50"> · {p.type}</span> : null}</td>
                <td className="py-2 text-center">{qty(p.quantity, p.unit ?? undefined)}</td>
                <td className="py-2 text-center">{qty(p.delivered_quantity, p.unit ?? undefined)}</td>
                <td className="py-2 text-right font-bold">{money(p.total)}</td>
              </tr>
            ))}
            {r.by_product.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-ge7-black/50">Aucune vente</td></tr>}
          </tbody>
        </table>
      </Card>
      <Card>
        <CardHeader title="Performance par vendeur" subtitle="Factures et chiffre d'affaires par agent de vente." />
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-ge7-black/10 text-left text-xs uppercase text-ge7-black/50">
              <th className="py-1.5">Vendeur</th>
              <th className="py-1.5 text-center">Factures</th>
              <th className="py-1.5 text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            {r.by_cashier.map((v) => (
              <tr key={v.cashier} className="border-b border-ge7-black/5">
                <td className="py-2 font-semibold">{v.cashier}</td>
                <td className="py-2 text-center">{v.sales_count}</td>
                <td className="py-2 text-right font-bold">{money(v.total)}</td>
              </tr>
            ))}
            {r.by_cashier.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-ge7-black/50">Aucune vente</td></tr>}
          </tbody>
        </table>
      </Card>
      <Card className="xl:col-span-2">
        <CardHeader title="Reliquats à livrer" subtitle="Quantités facturées non encore livrées, par facture et par produit." />
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-ge7-black/10 text-left text-xs uppercase text-ge7-black/50">
              <th className="py-1.5">Facture</th>
              <th className="py-1.5">Client</th>
              <th className="py-1.5">Produit</th>
              <th className="py-1.5 text-center">Facturé</th>
              <th className="py-1.5 text-center">Livré</th>
              <th className="py-1.5 text-center">Reste</th>
              <th className="py-1.5 text-right">Valeur</th>
            </tr>
          </thead>
          <tbody>
            {r.reliquats.map((l, i) => (
              <tr key={`${l.sale_id}-${i}`} className="border-b border-ge7-black/5">
                <td className="py-2 font-semibold">{l.number}</td>
                <td className="py-2">{l.customer}</td>
                <td className="py-2">{l.product}</td>
                <td className="py-2 text-center">{qty(l.ordered, l.unit ?? undefined)}</td>
                <td className="py-2 text-center">{qty(l.delivered, l.unit ?? undefined)}</td>
                <td className="py-2 text-center font-bold text-amber-700">{qty(l.remaining, l.unit ?? undefined)}</td>
                <td className="py-2 text-right font-bold">{money(l.remaining_value)}</td>
              </tr>
            ))}
            {r.reliquats.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-ge7-black/50">Aucun reliquat  tout est livré.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export function ReportsPage() {
  const week = lastWeek();
  const [from, setFrom] = useState(week.from);
  const [to, setTo] = useState(week.to);
  const [exporting, setExporting] = useState(false);

  const exportXlsx = async () => {
    setExporting(true);
    try {
      const { data } = await api.get<Blob>("/reports/sales/export", {
        params: { from, to },
        responseType: "blob",
      });
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rapport-commercial-${from}_${to}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const period = useQuery({
    queryKey: ["report-sales", from, to],
    queryFn: async () => (await api.get<{ data: SalesReport }>("/reports/sales", { params: { from, to } })).data.data,
  });
  const cumulative = useQuery({
    queryKey: ["report-sales-cumul"],
    queryFn: async () => (await api.get<{ data: SalesReport }>("/reports/sales")).data.data,
  });

  const r = period.data;
  const c = cumulative.data;

  return (
    <>
      <PageHeader
        title="Rapports de suivi"
        subtitle="Suivi des factures, livraisons et reliquats  procédure de gestion commerciale."
        breadcrumb="Pilotage"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => { const w = lastWeek(); setFrom(w.from); setTo(w.to); }}><CalendarDays size={15} /> Semaine écoulée</Button>
            <Button variant="purple" loading={exporting} onClick={() => void exportXlsx()}><FileSpreadsheet size={15} /> Exporter Excel</Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <Input label="Du" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="Au" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {period.isLoading ? (
        <Loading />
      ) : period.error || !r ? (
        <ErrorState message={toApiError(period.error).message} onRetry={() => void period.refetch()} />
      ) : (
        <>
          <h2 className="mb-3 font-display text-lg font-extrabold">A. Situation de la période</h2>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Factures émises" value={String(r.sales_count)} />
            <Stat label="Montant facturé" value={money(r.total)} accent />
            <Stat label="Valeur livrée" value={money(r.delivered_value)} />
            <Stat label="Reliquat à livrer" value={money(r.remaining_value)} />
          </div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ge7-black/60">Indicateurs de performance</h3>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Panier moyen" value={money(r.kpis.avg_basket)} accent />
            <Stat label="Taux de livraison" value={`${r.kpis.delivery_rate} %`} />
            <Stat label="Clients actifs" value={String(r.kpis.customers_count)} />
            <Stat label="Proformas émises / validées" value={`${r.kpis.quotes_count} / ${r.kpis.quotes_validated}`} />
          </div>
          <ReportTables r={r} />
        </>
      )}

      <h2 className="mb-3 mt-10 font-display text-lg font-extrabold">B. Situation cumulée depuis le démarrage</h2>
      {cumulative.isLoading ? (
        <Loading />
      ) : cumulative.error || !c ? (
        <ErrorState message={toApiError(cumulative.error).message} onRetry={() => void cumulative.refetch()} />
      ) : (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Factures émises" value={String(c.sales_count)} />
            <Stat label="Chiffre d'affaires cumulé" value={money(c.total)} accent />
            <Stat label="Valeur livrée" value={money(c.delivered_value)} />
            <Stat label="Reliquat à livrer" value={money(c.remaining_value)} />
          </div>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Panier moyen" value={money(c.kpis.avg_basket)} accent />
            <Stat label="Taux de livraison" value={`${c.kpis.delivery_rate} %`} />
            <Stat label="Clients actifs" value={String(c.kpis.customers_count)} />
            <Stat label="Proformas émises / validées" value={`${c.kpis.quotes_count} / ${c.kpis.quotes_validated}`} />
          </div>
          <ReportTables r={c} />
        </>
      )}

      <h2 className="mb-3 mt-10 font-display text-lg font-extrabold">C. Pilotage du magasin</h2>
      <PilotageSection />
    </>
  );
}
