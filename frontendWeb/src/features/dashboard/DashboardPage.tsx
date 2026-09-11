import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Banknote,
  Clock,
  CreditCard,
  PackageCheck,
  PackageX,
  ShoppingCart,
  Truck,
  Wallet,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";
import { getOne, toApiError } from "@/lib/api";
import type { DashboardStats } from "@/types";
import { money, relative } from "@/lib/format";
import { Card, CardHeader, ErrorState, KpiCard, Loading, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getOne<DashboardStats>("/dashboard"),
    refetchInterval: 120_000,
  });

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState message={toApiError(error).message} onRetry={() => void refetch()} />;

  return (
    <>
      <PageHeader
        title={`Bonjour, ${user?.name.split(" ")[0]}`}
        subtitle="Vue d'ensemble de l'activité G-ENERGY 7 GROUPE."
        breadcrumb="Pilotage"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Chiffre d'affaires" value={money(data.revenue)} trend={data.revenue_trend} hint="vs période précédente" icon={Banknote} tone="gold" />
        <KpiCard label="Commandes" value={data.orders_count} icon={ShoppingCart} tone="purple" to="/commandes" />
        <KpiCard label="En attente de validation" value={data.pending_orders} icon={Clock} tone="dark" to="/commandes?status=EN_ATTENTE" />
        <KpiCard label="Livraisons en cours" value={data.deliveries_in_progress} icon={Truck} tone="purple" to="/missions" />
        <KpiCard label="Livraisons terminées" value={data.deliveries_completed} icon={PackageCheck} tone="green" to="/livraisons" />
        <KpiCard label="Stock faible" value={data.low_stock} icon={AlertTriangle} tone={data.low_stock ? "red" : "green"} to="/stock?alert=low" />
        <KpiCard label="Ruptures" value={data.out_of_stock} icon={PackageX} tone={data.out_of_stock ? "red" : "green"} to="/stock?alert=out" />
        <KpiCard label="Ventes caisse" value={money(data.pos_sales)} icon={CreditCard} tone="gold" to="/caisse/ventes" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Ventes sur la période" subtitle="Chiffre d'affaires et volume de commandes" />
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={data.sales_series}>
                <defs>
                  <linearGradient id="gold" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#c9a227" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#c9a227" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} width={48} />
                <Tooltip formatter={(v: number, n: string) => (n === "revenue" ? money(v) : v)} labelClassName="font-semibold" />
                <Area type="monotone" dataKey="revenue" name="CA" stroke="#8a6a1c" strokeWidth={2.5} fill="url(#gold)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Top produits" subtitle="Parts des ventes" />
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={data.top_products} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#6a3fd1" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Achats & dépenses" />
          <div className="space-y-3">
            <Row icon={Wallet} label="Achats fournisseurs" value={money(data.purchases)} />
            <Row icon={Banknote} label="Dépenses" value={money(data.expenses)} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Alertes" />
          {data.alerts.length === 0 ? (
            <p className="text-sm text-ge7-black/50">Aucune alerte.</p>
          ) : (
            <ul className="space-y-2">
              {data.alerts.map((a, i) => (
                <li key={i}>
                  <Link
                    to={a.link ?? "#"}
                    className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
                      a.level === "danger"
                        ? "border-rose-200 bg-rose-50 text-rose-800"
                        : a.level === "warning"
                          ? "border-ge7-gold/40 bg-ge7-gold-soft text-ge7-bronze"
                          : "border-ge7-purple/30 bg-ge7-purple-soft text-ge7-purple"
                    }`}
                  >
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    {a.message}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Activité récente" />
          {data.recent_activity.length === 0 ? (
            <p className="text-sm text-ge7-black/50">Aucune activité.</p>
          ) : (
            <ul className="space-y-3">
              {data.recent_activity.map((a) => (
                <li key={a.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-ge7-gold" />
                  <div className="min-w-0">
                    <p className="truncate">
                      <span className="font-semibold">{a.user?.name ?? "Système"}</span> {a.action.toLowerCase()}{" "}
                      <span className="font-semibold text-ge7-purple">{a.subject_label ?? `#${a.subject_id}`}</span>
                    </p>
                    <p className="text-xs text-ge7-black/50">{relative(a.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-ge7-cream px-4 py-3">
      <span className="flex items-center gap-2 text-sm text-ge7-black/70">
        <Icon size={16} className="text-ge7-bronze" /> {label}
      </span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
