import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, PackageCheck } from "lucide-react";
import type { Mission } from "@/types";
import { useAction, useOne } from "@/lib/hooks";
import { qty } from "@/lib/format";
import { Button, Card, CardHeader, ErrorState, Input, Loading, PageHeader } from "@/components/ui";
import { SignaturePad } from "./SignaturePad";

interface Payload {
  mission_id: number;
  latitude: number | null;
  longitude: number | null;
  items: { order_item_id: number; delivered_quantity: number }[];
  client_signature: string;
  client_signer_name: string;
  driver_signature: string;
}

export function NewDeliveryPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const missionId = Number(params.get("mission"));
  const mission = useOne<Mission>("mission", missionId ? `/missions/${missionId}` : null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [clientSig, setClientSig] = useState<string | null>(null);
  const [driverSig, setDriverSig] = useState<string | null>(null);
  const [signer, setSigner] = useState("");
  const [gps, setGps] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition((p) => setGps({ latitude: p.coords.latitude, longitude: p.coords.longitude }), () => undefined, { enableHighAccuracy: true, timeout: 8000 });
  }, []);

  const create = useAction<Payload, { id: number }>(() => "/deliveries", { keys: ["mission", "missions", "orders", "order", "deliveries", "logistics", "dashboard", "site-stock"], success: "Livraison enregistrée", body: (v) => v });

  if (!missionId) return <ErrorState message="Mission non spécifiée" />;
  if (mission.isLoading) return <Loading />;
  if (!mission.data) return <ErrorState message="Mission introuvable" />;
  const m = mission.data;
  const items = m.order?.items ?? [];

  const submit = () => {
    if (!clientSig || !driverSig) return;
    create
      .mutateAsync({
        mission_id: m.id,
        latitude: gps?.latitude ?? null,
        longitude: gps?.longitude ?? null,
        items: items.map((it) => ({ order_item_id: it.id, delivered_quantity: quantities[it.id] ?? it.quantity - it.delivered_quantity })),
        client_signature: clientSig,
        client_signer_name: signer,
        driver_signature: driverSig,
      })
      .then((d) => navigate(`/livraisons/${d.id}`))
      .catch(() => {});
  };

  return (
    <>
      <PageHeader breadcrumb={<Link to={`/missions/${m.id}`} className="inline-flex items-center gap-1 hover:underline"><ArrowLeft size={12} /> {m.number}</Link>} title="Effectuer la livraison" subtitle={`${m.order?.chantier?.name} · ${m.order?.client?.company_name}`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Quantités livrées" subtitle="Ajustez si la livraison est partielle." />
          <div className="space-y-2">
            {items.map((it) => {
              const remaining = it.quantity - it.delivered_quantity;
              return (
                <div key={it.id} className="grid items-center gap-3 rounded-2xl bg-ge7-cream p-3 sm:grid-cols-[1fr_140px]">
                  <div><p className="font-semibold">{it.product?.name}</p><p className="text-xs text-ge7-black/50">Reste à livrer : {qty(remaining, it.product?.unit?.symbol)}</p></div>
                  <Input type="number" min={0} max={remaining} step="any" value={quantities[it.id] ?? remaining} onChange={(e) => setQuantities({ ...quantities, [it.id]: Number(e.target.value) })} />
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-ge7-black/50">Position GPS : {gps ? `${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}` : "non disponible (autorisez la géolocalisation)"}</p>
        </Card>
        <Card>
          <CardHeader title="Signatures" subtitle="Les deux signatures sont obligatoires." />
          <div className="space-y-5">
            <Input label="Nom du signataire client" required value={signer} onChange={(e) => setSigner(e.target.value)} placeholder="ex. Chef de chantier" />
            <SignaturePad label="Signature client" onChange={setClientSig} />
            <SignaturePad label={`Signature chauffeur — ${m.driver?.name ?? ""}`} onChange={setDriverSig} />
          </div>
          <Button className="mt-6 w-full" size="lg" disabled={!clientSig || !driverSig || !signer} loading={create.isPending} onClick={submit}>
            <PackageCheck size={18} /> Confirmer la livraison
          </Button>
        </Card>
      </div>
    </>
  );
}
