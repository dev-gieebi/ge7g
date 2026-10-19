import { useNavigate } from "react-router-dom";
import { Truck } from "lucide-react";
import type { CommandeListItem } from "@/types";
import { useListState, usePaginated } from "@/lib/hooks";
import { date, money } from "@/lib/format";
import { DataTable, PageHeader, StatusBadge, type Column } from "@/components/ui";

/**
 * Espace du chauffeur : uniquement les commandes qui lui sont affectées
 * (filtre appliqué côté serveur). Rafraîchi toutes les 15 s.
 */
export function DriverHomePage() {
  const navigate = useNavigate();
  const list = useListState({ per_page: 20 });
  const { data, isLoading, errorMessage } = usePaginated<CommandeListItem>("mes-livraisons", "/commandes", list.params, true, 15_000);

  const columns: Column<CommandeListItem>[] = [
    { key: "numero", header: "N°", render: (c) => <span className="font-semibold">{c.numero}</span> },
    { key: "cree_le", header: "Date", render: (c) => date(c.cree_le) },
    { key: "client", header: "Client", render: (c) => <span className="font-medium">{c.client}</span> },
    { key: "telephone", header: "Téléphone", render: (c) => c.telephone },
    { key: "quartier", header: "Livraison", render: (c) => `${c.quartier} · ${c.ville}` },
    { key: "total", header: "À encaisser", align: "right", render: (c) => <span className="font-bold">{money(c.total)}</span> },
    { key: "statut", header: "Statut", render: (c) => <StatusBadge status={c.statut} /> },
  ];

  return (
    <>
      <PageHeader
        title="Mes livraisons"
        subtitle="Commandes qui vous sont affectées — ouvrez une commande pour démarrer la mission et suivre la carte."
        breadcrumb="Livraisons"
      />
      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-ge7-gold/30 bg-ge7-gold-soft/40 px-4 py-3 text-sm font-medium text-ge7-black/80">
        <Truck size={16} className="shrink-0 text-ge7-bronze" />
        Au départ de la mission, votre position GPS est enregistrée puis partagée avec le client pendant la livraison.
      </div>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        error={errorMessage}
        rowKey={(c) => c.id}
        page={list.page}
        onPageChange={list.setPage}
        onRowClick={(c) => navigate(`/admin/mes-livraisons/${c.id}`)}
        emptyTitle="Aucune livraison affectée"
      />
    </>
  );
}
