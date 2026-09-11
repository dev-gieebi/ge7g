import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, toApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canSeeCosts } from "@/lib/rbac";
import { money, percent, qty } from "@/lib/format";
import { Button, Card, CardHeader, ErrorState, Input, Loading, PageHeader } from "@/components/ui";

interface Report {
  period: { from: string; to: string };
  sales: { label: string; orders: number; pos: number }[];
  totals: { orders_revenue: number; pos_revenue: number; purchases: number; margin?: number; margin_percent?: number };
  top_products: { name: string; quantity: number; revenue: number; unit: string }[];
  top_clients: { name: string; orders: number; revenue: number }[];
  deliveries: { completed: number; partial: number; on_time_rate: number };
}

const firstOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };

export function ReportsPage() {
  const { user } = useAuth();
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["reports", from, to],
    queryFn: async () => (await api.get<{ data: Report }>("/reports/overview", { params: { from, to } })).data.data,
  });

  const exportCsv = async () => {
    const res = await api.get("/reports/export", { params: { from, to }, responseType: "blob" });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader title="Rapports" subtitle="Ventes, achats, marges et performance logistique sur une période." breadcrumb="Pilotage" action={<Button variant="secondary" onClick={() => void exportCsv()}><Download size={15} /> Export CSV</Button>} />
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <Input label="Du" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="Au" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {isLoading ? (
        <Loading />
      ) : error || !data ? (
        <ErrorState message={toApiError(error).message} onRetry={() => void refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="CA commandes" value={money(data.totals.orders_revenue)} />
            <Stat label="CA caisse" value={money(data.totals.pos_revenue)} />
            <Stat label="Achats" value={money(data.totals.purchases)} />
            {canSeeCosts(user) && data.totals.margin !== undefined ? <Stat label="Marge brute" value={`${money(data.totals.margin)} · ${percent(data.totals.margin_percent)}`} accent /> : <Stat label="Livraisons à l'heure" value={percent(data.deliveries.on_time_rate)} />}
          </div>
          <Card className="mt-6">
            <CardHeader title="Chiffre d'affaires par période" />
            <div className="h-80">
              <ResponsiveContainer>
                <BarChart data={data.sales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} width={48} />
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Legend />
                  <Bar dataKey="orders" name="Commandes" stackId="a" fill="#c9a227" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="pos" name="Caisse" stackId="a" fill="#6a3fd1" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Top produits" />
              <table className="w-full text-sm"><tbody className="divide-y divide-ge7-black/5">{data.top_products.map((p) => <tr key={p.name}><td className="py-2 font-semibold">{p.name}</td><td className="py-2 text-right text-ge7-black/60">{qty(p.quantity, p.unit)}</td><td className="py-2 text-right font-bold">{money(p.revenue)}</td></tr>)}</tbody></table>
            </Card>
            <Card>
              <CardHeader title="Top clients" />
              <table className="w-full text-sm"><tbody className="divide-y divide-ge7-black/5">{data.top_clients.map((c) => <tr key={c.name}><td className="py-2 font-semibold">{c.name}</td><td className="py-2 text-right text-ge7-black/60">{c.orders} cmd</td><td className="py-2 text-right font-bold">{money(c.revenue)}</td></tr>)}</tbody></table>
            </Card>
          </div>
          <Card className="mt-6">
            <CardHeader title="Logistique" />
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="Livraisons complètes" value={data.deliveries.completed} />
              <Stat label="Livraisons partielles" value={data.deliveries.partial} />
              <Stat label="Taux à l'heure" value={percent(data.deliveries.on_time_rate)} />
            </div>
          </Card>
        </>
      )}
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={`rounded-3xl border p-5 ${accent ? "border-ge7-gold/40 bg-gradient-to-br from-ge7-gold-soft to-white" : "border-ge7-black/5 bg-white"} shadow-soft`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-ge7-black/50">{label}</p>
      <p className="mt-2 font-display text-xl font-extrabold">{value}</p>
    </div>
  );
}
