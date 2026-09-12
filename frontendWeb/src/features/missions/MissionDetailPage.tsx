import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Flag, MapPin, Navigation, PackageCheck } from "lucide-react";
import type { Mission } from "@/types";
import { useAction, useOne } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { datetime, qty, relative } from "@/lib/format";
import { Badge, Button, Card, CardHeader, ErrorState, Loading, PageHeader, StatusBadge } from "@/components/ui";
import { MissionMap } from "./MissionMap";

const KEYS = ["mission", "missions", "orders", "order", "logistics", "dashboard", "deliveries"];

export function MissionDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const canAct = hasRole(user, "AG_LOGISTIQUE", "DIRECTION");
  const mission = useOne<Mission>("mission", id ? `/missions/${id}` : null);

  const depart = useAction(() => `/missions/${id}/depart`, { keys: KEYS, success: "Départ enregistré" });
  const arrive = useAction(() => `/missions/${id}/arrive`, { keys: KEYS, success: "Arrivée enregistrée" });

  if (mission.isLoading) return <Loading />;
  if (!mission.data) return <ErrorState message="Mission introuvable" />;
  const m = mission.data;
  const o = m.order;
  const gpsFresh = m.last_location && Date.now() - new Date(m.last_location.recorded_at).getTime() < 5 * 60_000;

  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/missions" className="inline-flex items-center gap-1 hover:underline"><ArrowLeft size={12} /> Missions</Link>}
        title={m.number}
        subtitle={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={m.status} /><span className="text-ge7-black/60">Commande <Link to={`/commandes/${m.order_id}`} className="font-semibold text-ge7-purple hover:underline">{o?.number}</Link></span></span>}
        action={
          canAct && (
            <>
              {m.status === "AFFECTEE" && <Button variant="purple" loading={depart.isPending} onClick={() => depart.mutate()}><Navigation size={16} /> Valider le départ</Button>}
              {(m.status === "DEPART" || m.status === "EN_LIVRAISON") && <Button loading={arrive.isPending} onClick={() => arrive.mutate()}><Flag size={16} /> Arrivée au chantier</Button>}
              {m.status === "ARRIVEE" && <Link to={`/livraisons/nouvelle?mission=${m.id}`}><Button><PackageCheck size={16} /> Effectuer la livraison</Button></Link>}
            </>
          )
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="mb-3 flex items-center gap-3 text-sm">
            <span className={`inline-flex items-center gap-1.5 font-semibold ${gpsFresh ? "text-emerald-700" : "text-ge7-black/50"}`}>
              <span className={`size-2.5 rounded-full ${gpsFresh ? "animate-pulse bg-emerald-500" : "bg-ge7-black/30"}`} />
              {m.status === "DEPART" || m.status === "EN_LIVRAISON" ? "Chauffeur en route" : m.status.replace(/_/g, " ")}
            </span>
            {m.last_location && <span className="text-ge7-black/60">Dernière position : {relative(m.last_location.recorded_at)}</span>}
          </div>
          <MissionMap missions={[m]} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Chauffeur & véhicule" />
            <p className="font-bold">{m.driver?.name}</p>
            <p className="text-sm text-ge7-black/60">{m.driver?.phone}</p>
            <p className="mt-2 text-sm">Véhicule : <span className="font-semibold">{m.vehicle ? `${m.vehicle.plate} · ${m.vehicle.model}` : "—"}</span></p>
          </Card>
          <Card>
            <CardHeader title="Destination" />
            <p className="flex items-start gap-2 text-sm"><MapPin size={15} className="mt-0.5 text-ge7-bronze" /><span><span className="font-semibold">{o?.chantier?.name}</span><br />{o?.chantier?.address}</span></p>
            <p className="mt-2 text-sm text-ge7-black/60">Client : {o?.client?.company_name}</p>
            {o?.chantier?.manager_phone && <p className="text-sm text-ge7-black/60">Contact : {o.chantier.manager_name} · {o.chantier.manager_phone}</p>}
          </Card>
          <Card>
            <CardHeader title="Chronologie" />
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-ge7-black/60">Prévu</dt><dd>{datetime(m.scheduled_at)}</dd></div>
              <div className="flex justify-between"><dt className="text-ge7-black/60">Départ</dt><dd>{datetime(m.started_at)}</dd></div>
              <div className="flex justify-between"><dt className="text-ge7-black/60">Arrivée</dt><dd>{datetime(m.arrived_at)}</dd></div>
              <div className="flex justify-between"><dt className="text-ge7-black/60">Terminée</dt><dd>{datetime(m.completed_at)}</dd></div>
            </dl>
          </Card>
          <Card>
            <CardHeader title="À livrer" />
            <ul className="divide-y divide-ge7-black/5 text-sm">
              {o?.items?.map((it) => (
                <li key={it.id} className="flex justify-between py-1.5">
                  <span>{it.product?.name}</span>
                  <span className="font-semibold">{qty(it.quantity - it.delivered_quantity, it.product?.unit?.symbol)}{it.delivered_quantity > 0 && <Badge tone="amber" className="ml-2">reste</Badge>}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
