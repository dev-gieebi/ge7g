import type { ReactNode } from "react";
import { ModuleTabs } from "@/components/ui";
import { LOGISTIQUE_TABS } from "@/app/moduleTabs";
import { Link } from "react-router-dom";
import { CheckCircle2, Play } from "lucide-react";
import type { Order } from "@/types";
import { useAction, useListState, usePaginated } from "@/lib/hooks";
import { datetime, qty } from "@/lib/format";
import { Badge, Button, Card, EmptyState, ErrorState, Loading, PageHeader, StatusBadge } from "@/components/ui";

const KEYS = ["orders", "order", "logistics", "dashboard"];

export function PreparationPage() {
  const list = useListState({ per_page: 50, status: "VALIDEE,EN_PREPARATION", sort: "requested_date", dir: "asc" });
  const { data, isLoading, errorMessage, refetch } = usePaginated<Order>("orders", "/orders", list.params);
  const start = useAction<number>((id) => `/orders/${id}/prepare`, { keys: KEYS, success: "Préparation démarrée" });
  const finish = useAction<number>((id) => `/orders/${id}/ready`, { keys: KEYS, success: "Commande prête pour la livraison" });

  const orders = data?.data ?? [];
  const toStart = orders.filter((o) => o.status === "VALIDEE");
  const inProgress = orders.filter((o) => o.status === "EN_PREPARATION");

  if (isLoading) return <Loading />;
  if (errorMessage) return <ErrorState message={errorMessage} onRetry={() => void refetch()} />;

  const Column = ({ title, items, tone, action }: { title: string; items: Order[]; tone: "amber" | "purple"; action: (o: Order) => ReactNode }) => (
    <div>
      <h3 className="mb-3 flex items-center gap-2 font-bold">
        {title} <Badge tone={tone}>{items.length}</Badge>
      </h3>
      {items.length === 0 ? (
        <EmptyState title="Rien à traiter" />
      ) : (
        <div className="space-y-3">
          {items.map((o) => (
            <Card key={o.id} className="!p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link to={`/commandes/${o.id}`} className="font-bold text-ge7-purple hover:underline">{o.number}</Link>
                  <p className="text-sm font-semibold">{o.client?.company_name}</p>
                  <p className="text-xs text-ge7-black/60">{o.chantier?.name} · souhaité {datetime(o.requested_date)}</p>
                </div>
                <StatusBadge status={o.status} />
              </div>
              <ul className="mt-3 divide-y divide-ge7-black/5 rounded-xl bg-ge7-cream text-sm">
                {o.items?.map((it) => (
                  <li key={it.id} className="flex justify-between px-3 py-1.5">
                    <span>{it.product?.name}{it.product?.type ? <span className="text-ge7-black/50"> · {it.product.type}</span> : null}</span>
                    <span className="font-semibold">{qty(it.quantity, it.product?.unit?.symbol)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-end">{action(o)}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <ModuleTabs tabs={LOGISTIQUE_TABS} />
      <PageHeader title="Préparation des commandes" subtitle="Commandes validées à préparer, puis à marquer prêtes pour l'affectation d'un chauffeur." breadcrumb="Opérations" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Column title="À préparer" items={toStart} tone="amber" action={(o) => <Button size="sm" variant="purple" loading={start.isPending && start.variables === o.id} onClick={() => start.mutate(o.id)}><Play size={14} /> Démarrer</Button>} />
        <Column title="En préparation" items={inProgress} tone="purple" action={(o) => <Button size="sm" loading={finish.isPending && finish.variables === o.id} onClick={() => finish.mutate(o.id)}><CheckCircle2 size={14} /> Préparation terminée</Button>} />
      </div>
    </>
  );
}
