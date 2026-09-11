import { Link, useParams } from "react-router-dom";
import { ArrowLeft, HardHat, Mail, MapPin, Phone, ShoppingCart } from "lucide-react";
import type { Chantier, Client, Order } from "@/types";
import { useOne, usePaginated } from "@/lib/hooks";
import { Badge, Card, CardHeader, DataTable, ErrorState, Loading, PageHeader, StatusBadge, type Column } from "@/components/ui";
import { date, money } from "@/lib/format";

export function ClientDetailPage() {
  const { id } = useParams();
  const client = useOne<Client>("client", id ? `/clients/${id}` : null);
  const chantiers = usePaginated<Chantier>("chantiers", "/chantiers", { client_id: id, per_page: 10 }, !!id);
  const orders = usePaginated<Order>("orders", "/orders", { client_id: id, per_page: 10 }, !!id);

  if (client.isLoading) return <Loading />;
  if (!client.data) return <ErrorState message="Client introuvable" />;
  const c = client.data;

  const chantierCols: Column<Chantier>[] = [
    { key: "name", header: "Chantier", render: (x) => <span className="font-semibold">{x.name}</span> },
    { key: "address", header: "Adresse", render: (x) => x.address },
    { key: "zone", header: "Zone", render: (x) => x.zone?.name ?? "—" },
    { key: "status", header: "Statut", render: (x) => <StatusBadge status={x.status} /> },
  ];
  const orderCols: Column<Order>[] = [
    { key: "number", header: "N°", render: (o) => <Link to={`/commandes/${o.id}`} className="font-semibold text-ge7-purple hover:underline">{o.number}</Link> },
    { key: "chantier", header: "Chantier", render: (o) => o.chantier?.name ?? "—" },
    { key: "created_at", header: "Date", render: (o) => date(o.created_at) },
    { key: "total", header: "Total", align: "right", render: (o) => <span className="font-semibold">{money(o.total)}</span> },
    { key: "status", header: "Statut", render: (o) => <StatusBadge status={o.status} /> },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link to="/clients" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeft size={12} /> Clients
          </Link>
        }
        title={c.company_name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={c.status} />
            <Badge tone="purple">{c.client_type}</Badge>
            {c.zone && <Badge tone="gold">{c.zone.name}</Badge>}
          </span>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Coordonnées" />
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2"><Phone size={15} className="text-ge7-bronze" /> {c.phone || "—"}</li>
            <li className="flex items-center gap-2"><Mail size={15} className="text-ge7-bronze" /> {c.email || "—"}</li>
            <li className="flex items-center gap-2"><MapPin size={15} className="text-ge7-bronze" /> {c.address || "—"}</li>
          </ul>
          <p className="mt-4 text-xs text-ge7-black/50">Contact : {c.contact_name || "—"}</p>
          <p className="text-xs text-ge7-black/50">Client depuis le {date(c.created_at)}</p>
        </Card>
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h3 className="mb-3 flex items-center gap-2 font-bold"><HardHat size={16} className="text-ge7-bronze" /> Chantiers</h3>
            <DataTable columns={chantierCols} data={chantiers.data} isLoading={chantiers.isLoading} error={chantiers.errorMessage} rowKey={(x) => x.id} emptyTitle="Aucun chantier" emptyHint="Les chantiers sont créés par le client depuis l'application mobile." dense />
          </div>
          <div>
            <h3 className="mb-3 flex items-center gap-2 font-bold"><ShoppingCart size={16} className="text-ge7-bronze" /> Commandes récentes</h3>
            <DataTable columns={orderCols} data={orders.data} isLoading={orders.isLoading} error={orders.errorMessage} rowKey={(x) => x.id} emptyTitle="Aucune commande" dense />
          </div>
        </div>
      </div>
    </>
  );
}
