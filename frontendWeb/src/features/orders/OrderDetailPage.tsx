import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, ClipboardList, Truck, X } from "lucide-react";
import type { Order } from "@/types";
import { useAction, useOne } from "@/lib/hooks";
import { useDriversRef, useVehiclesRef } from "@/features/shared/refData";
import { date, datetime, money, qty } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { Badge, Button, Card, CardHeader, ErrorState, FormGrid, Input, Loading, Modal, PageHeader, Select, StatusBadge, Textarea } from "@/components/ui";

const KEYS = ["order", "orders", "products", "dashboard", "logistics", "missions"];

export function OrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const isAdmin = hasRole(user, "AG_LOGISTIQUE", "DIRECTION");
  const order = useOne<Order>("order", id ? `/orders/${id}` : null);
  const { data: drivers } = useDriversRef();
  const { data: vehicles } = useVehiclesRef();
  const [refuse, setRefuse] = useState<string | null>(null);
  const [assign, setAssign] = useState<{ driver_id?: number; vehicle_id?: number; scheduled_at: string } | null>(null);

  const validate = useAction(() => `/orders/${id}/validate`, { keys: KEYS, success: "Commande validée — stock réservé" });
  const doRefuse = useAction<{ reason: string }>(() => `/orders/${id}/refuse`, { keys: KEYS, success: "Commande refusée", body: (v) => v });
  const prepare = useAction(() => `/orders/${id}/prepare`, { keys: KEYS, success: "Commande envoyée en préparation" });
  const doAssign = useAction<NonNullable<typeof assign>>(() => `/orders/${id}/assign-driver`, { keys: KEYS, success: "Chauffeur affecté — mission créée", body: (v) => v });

  if (order.isLoading) return <Loading />;
  if (!order.data) return <ErrorState message="Commande introuvable" />;
  const o = order.data;

  const stockIssue = o.items?.some((it) => it.product && it.product.available_quantity < it.quantity);

  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/commandes" className="inline-flex items-center gap-1 hover:underline"><ArrowLeft size={12} /> Commandes</Link>}
        title={o.number}
        subtitle={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={o.status} /><span className="text-ge7-black/60">créée le {datetime(o.created_at)}</span></span>}
        action={
          isAdmin && (
            <>
              {o.status === "EN_ATTENTE" && (
                <>
                  <Button variant="danger" onClick={() => setRefuse("")}><X size={16} /> Refuser</Button>
                  <Button onClick={() => validate.mutate()} loading={validate.isPending}><Check size={16} /> Valider</Button>
                </>
              )}
              {o.status === "VALIDEE" && <Button variant="purple" onClick={() => prepare.mutate()} loading={prepare.isPending}><ClipboardList size={16} /> Envoyer en préparation</Button>}
              {o.status === "PRETE" && !o.mission && <Button variant="purple" onClick={() => setAssign({ scheduled_at: new Date().toISOString().slice(0, 16) })}><Truck size={16} /> Affecter un chauffeur</Button>}
            </>
          )
        }
      />

      {o.status === "EN_ATTENTE" && stockIssue && (
        <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          Stock insuffisant pour au moins une ligne. La validation sera refusée par le serveur tant que le stock n'est pas réapprovisionné.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card padded={false}>
            <table className="w-full text-sm">
              <thead className="bg-ge7-black text-left text-xs uppercase tracking-wider text-ge7-gold-light">
                <tr>
                  <th className="px-5 py-3">Produit</th>
                  <th className="px-5 py-3 text-right">Qté</th>
                  <th className="px-5 py-3 text-right">Livré</th>
                  <th className="px-5 py-3 text-right">PU (figé)</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-right">Stock dispo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ge7-black/5">
                {o.items?.map((it) => {
                  const short = it.product && it.product.available_quantity < it.quantity && ["EN_ATTENTE", "BROUILLON"].includes(o.status);
                  return (
                    <tr key={it.id}>
                      <td className="px-5 py-3"><p className="font-semibold">{it.product?.name}</p><p className="text-xs text-ge7-black/50">{it.product?.reference}{it.product?.type ? ` · ${it.product.type}` : ""}</p></td>
                      <td className="px-5 py-3 text-right">{qty(it.quantity, it.product?.unit?.symbol)}</td>
                      <td className="px-5 py-3 text-right">{qty(it.delivered_quantity)}</td>
                      <td className="px-5 py-3 text-right">{money(it.unit_price)}</td>
                      <td className="px-5 py-3 text-right font-semibold">{money(it.total)}</td>
                      <td className={`px-5 py-3 text-right ${short ? "font-bold text-rose-600" : "text-ge7-black/60"}`}>{it.product ? qty(it.product.available_quantity) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-ge7-cream text-sm">
                <tr><td colSpan={4} className="px-5 py-2 text-right text-ge7-black/60">Sous-total</td><td className="px-5 py-2 text-right font-semibold">{money(o.subtotal)}</td><td /></tr>
                <tr><td colSpan={4} className="px-5 py-2 text-right text-ge7-black/60">Taxe</td><td className="px-5 py-2 text-right font-semibold">{money(o.tax_amount)}</td><td /></tr>
                <tr><td colSpan={4} className="px-5 py-3 text-right font-bold">TOTAL</td><td className="px-5 py-3 text-right text-lg font-extrabold text-ge7-bronze">{money(o.total)}</td><td /></tr>
              </tfoot>
            </table>
          </Card>
          {o.note && <Card><CardHeader title="Note du client" /><p className="text-sm">{o.note}</p></Card>}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Client & chantier" />
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-ge7-black/50">Client</dt><dd><Link to={`/clients/${o.client_id}`} className="font-semibold text-ge7-purple hover:underline">{o.client?.company_name}</Link></dd></div>
              <div><dt className="text-xs text-ge7-black/50">Chantier</dt><dd><Link to={`/chantiers/${o.chantier_id}`} className="font-semibold text-ge7-purple hover:underline">{o.chantier?.name}</Link><p className="text-xs text-ge7-black/60">{o.chantier?.address}</p></dd></div>
              <div><dt className="text-xs text-ge7-black/50">Date souhaitée</dt><dd>{date(o.requested_date)}</dd></div>
            </dl>
          </Card>
          <Card>
            <CardHeader title="Mission" />
            {o.mission ? (
              <div className="space-y-2 text-sm">
                <Link to={`/missions/${o.mission.id}`} className="font-bold text-ge7-purple hover:underline">{o.mission.number}</Link>
                <p>Chauffeur : <span className="font-semibold">{o.mission.driver?.name}</span></p>
                <p>Véhicule : {o.mission.vehicle?.plate ?? "—"}</p>
                <p>Prévu : {datetime(o.mission.scheduled_at)}</p>
                <StatusBadge status={o.mission.status} />
              </div>
            ) : (
              <p className="text-sm text-ge7-black/50">Aucun chauffeur affecté.</p>
            )}
          </Card>
          <Card>
            <CardHeader title="Cycle de vie" />
            <ol className="space-y-1.5 text-xs">
              {["EN_ATTENTE", "VALIDEE", "EN_PREPARATION", "PRETE", "EN_LIVRAISON", "LIVREE", "RECEPTION_CONFIRMEE", "CLOTUREE"].map((s, i, arr) => {
                const idx = arr.indexOf(o.status);
                const done = idx >= i;
                return (
                  <li key={s} className={`flex items-center gap-2 ${done ? "text-ge7-black" : "text-ge7-black/35"}`}>
                    <span className={`size-2 rounded-full ${done ? "bg-ge7-gold" : "bg-ge7-black/15"}`} />
                    {s.replace(/_/g, " ")}
                    {o.status === s && <Badge tone="gold" className="ml-auto">actuel</Badge>}
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>
      </div>

      {refuse !== null && (
        <Modal title="Refuser la commande" size="sm" onClose={() => setRefuse(null)} footer={<><Button variant="secondary" onClick={() => setRefuse(null)}>Annuler</Button><Button variant="danger" loading={doRefuse.isPending} onClick={() => doRefuse.mutateAsync({ reason: refuse }).then(() => setRefuse(null)).catch(() => {})}>Confirmer le refus</Button></>}>
          <Textarea label="Motif" required value={refuse} onChange={(e) => setRefuse(e.target.value)} />
        </Modal>
      )}

      {assign && (
        <Modal title="Affecter un chauffeur" subtitle="Crée une mission de livraison pour cette commande." size="sm" onClose={() => setAssign(null)} footer={<><Button variant="secondary" onClick={() => setAssign(null)}>Annuler</Button><Button variant="purple" loading={doAssign.isPending} onClick={() => doAssign.mutateAsync(assign).then(() => setAssign(null)).catch(() => {})}>Créer la mission</Button></>}>
          <FormGrid cols={1}>
            <Select label="Chauffeur" required value={String(assign.driver_id ?? "")} onChange={(e) => setAssign({ ...assign, driver_id: Number(e.target.value) })}>
              <option value="">—</option>
              {drivers?.map((d) => <option key={d.id} value={d.id} disabled={d.status !== "DISPONIBLE"}>{d.name} · {d.status}</option>)}
            </Select>
            <Select label="Véhicule" value={String(assign.vehicle_id ?? "")} onChange={(e) => setAssign({ ...assign, vehicle_id: e.target.value ? Number(e.target.value) : undefined })}>
              <option value="">—</option>
              {vehicles?.map((v) => <option key={v.id} value={v.id} disabled={v.status !== "DISPONIBLE"}>{v.plate} · {v.model}</option>)}
            </Select>
            <Input label="Départ prévu" type="datetime-local" value={assign.scheduled_at} onChange={(e) => setAssign({ ...assign, scheduled_at: e.target.value })} />
          </FormGrid>
        </Modal>
      )}
    </>
  );
}
