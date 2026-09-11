import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, MapPin } from "lucide-react";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import type { Delivery } from "@/types";
import { useAction, useOne } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { datetime, qty } from "@/lib/format";
import { Badge, Button, Card, CardHeader, ErrorState, Loading, PageHeader, StatusBadge } from "@/components/ui";
import "@/lib/leaflet";

export function DeliveryDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const delivery = useOne<Delivery>("delivery", id ? `/deliveries/${id}` : null);
  const confirm = useAction(() => `/deliveries/${id}/confirm-reception`, { keys: ["delivery", "deliveries", "orders", "order", "site-stock", "logistics", "dashboard"], success: "Réception confirmée — stock chantier mis à jour" });

  if (delivery.isLoading) return <Loading />;
  if (!delivery.data) return <ErrorState message="Livraison introuvable" />;
  const d = delivery.data;
  const canConfirm = d.status === "LIVREE" && hasRole(user, "ADMIN", "DIRECTION");

  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/livraisons" className="inline-flex items-center gap-1 hover:underline"><ArrowLeft size={12} /> Livraisons</Link>}
        title={`Livraison ${d.mission?.number ?? `#${d.id}`}`}
        subtitle={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={d.status} />{d.is_partial && <Badge tone="amber">Partielle</Badge>}<span className="text-ge7-black/60">{datetime(d.delivered_at)}</span></span>}
        action={canConfirm && <Button loading={confirm.isPending} onClick={() => confirm.mutate()}><CheckCircle2 size={16} /> Confirmer la réception</Button>}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card padded={false}>
            <table className="w-full text-sm">
              <thead className="bg-ge7-black text-left text-xs uppercase tracking-wider text-ge7-gold-light">
                <tr><th className="px-5 py-3">Produit</th><th className="px-5 py-3 text-right">Prévu</th><th className="px-5 py-3 text-right">Livré</th><th className="px-5 py-3 text-right">Écart</th></tr>
              </thead>
              <tbody className="divide-y divide-ge7-black/5">
                {d.items?.map((it) => {
                  const diff = it.delivered_quantity - it.planned_quantity;
                  return (
                    <tr key={it.id}>
                      <td className="px-5 py-3 font-semibold">{it.product?.name}</td>
                      <td className="px-5 py-3 text-right">{qty(it.planned_quantity, it.product?.unit?.symbol)}</td>
                      <td className="px-5 py-3 text-right font-bold">{qty(it.delivered_quantity, it.product?.unit?.symbol)}</td>
                      <td className={`px-5 py-3 text-right ${diff < 0 ? "text-rose-600" : "text-ge7-black/50"}`}>{diff === 0 ? "—" : qty(diff)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          <div className="grid gap-6 sm:grid-cols-2">
            {(["CLIENT"] as const).map((type) => {
              const s = d.signatures?.find((x) => x.type === type);
              return (
                <Card key={type}>
                  <CardHeader title="Signature client" />
                  {s ? (
                    <>
                      <div className="grid h-36 place-items-center rounded-2xl border border-ge7-black/10 bg-white"><img src={s.image_url} alt={`Signature ${type}`} className="max-h-full max-w-full" /></div>
                      <p className="mt-2 text-sm font-semibold">{s.signer_name}</p>
                      <p className="text-xs text-ge7-black/50">{datetime(s.signed_at)}</p>
                    </>
                  ) : (
                    <p className="text-sm text-ge7-black/50">Non signée</p>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Contexte" />
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-ge7-black/50">Commande</dt><dd><Link to={`/commandes/${d.order_id}`} className="font-semibold text-ge7-purple hover:underline">{d.order?.number}</Link></dd></div>
              <div><dt className="text-xs text-ge7-black/50">Mission</dt><dd><Link to={`/missions/${d.mission_id}`} className="font-semibold text-ge7-purple hover:underline">{d.mission?.number}</Link></dd></div>
              <div><dt className="text-xs text-ge7-black/50">Chauffeur</dt><dd>{d.mission?.driver?.name}</dd></div>
              <div><dt className="text-xs text-ge7-black/50">Chantier</dt><dd><Link to={`/chantiers/${d.chantier_id}`} className="font-semibold text-ge7-purple hover:underline">{d.chantier?.name}</Link></dd></div>
            </dl>
          </Card>
          <Card>
            <CardHeader title="Position GPS" />
            {d.latitude && d.longitude ? (
              <div className="h-48 overflow-hidden rounded-2xl">
                <MapContainer center={[d.latitude, d.longitude]} zoom={15} className="h-full w-full" scrollWheelZoom={false}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[d.latitude, d.longitude]} />
                </MapContainer>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm text-ge7-black/50"><MapPin size={15} /> Position non enregistrée</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
