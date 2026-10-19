import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import type { CommandeListItem, StatutCommande } from "@/types";
import { useListState, usePaginated } from "@/lib/hooks";
import { useToast } from "@/lib/toast";
import { date, money } from "@/lib/format";
import { Badge, DataTable, Input, PageHeader, SearchInput, Select, StatusBadge, type Column } from "@/components/ui";
import { STATUT_LABELS, STATUTS } from "./statuts";

export function OrdersPage() {
  const navigate = useNavigate();
  const notify = useToast();
  const [params] = useSearchParams();
  const list = useListState({ per_page: 20, statut: params.get("statut") ?? undefined });
  // Rafraîchissement automatique toutes les 30 s pour voir arriver les commandes.
  const { data, isLoading, errorMessage } = usePaginated<CommandeListItem>("commandes", "/commandes", list.params, true, 30_000);

  // Signal visuel à l'arrivée d'une nouvelle commande en attente.
  const enAttente = data?.meta.en_attente ?? 0;
  const previous = useRef<number | null>(null);
  useEffect(() => {
    if (previous.current !== null && enAttente > previous.current) {
      notify(`${enAttente - previous.current} nouvelle(s) commande(s) en attente`, "success");
    }
    previous.current = enAttente;
  }, [enAttente, notify]);

  const statut = String(list.params.statut ?? "");

  const columns: Column<CommandeListItem>[] = [
    { key: "numero", header: "N°", render: (c) => <span className="font-semibold">{c.numero}</span> },
    { key: "cree_le", header: "Date", render: (c) => date(c.cree_le) },
    { key: "client", header: "Client", render: (c) => <span className="font-medium">{c.client}</span> },
    { key: "telephone", header: "Téléphone", render: (c) => c.telephone },
    { key: "quartier", header: "Quartier", render: (c) => `${c.quartier} · ${c.ville}` },
    { key: "total", header: "Montant", align: "right", render: (c) => <span className="font-bold">{money(c.total)}</span> },
    { key: "statut", header: "Statut", render: (c) => <StatusBadge status={c.statut} /> },
    { key: "chauffeur", header: "Chauffeur", render: (c) => c.chauffeur ?? "" },
  ];

  return (
    <>
      <PageHeader
        title="Commandes en ligne"
        subtitle="Commandes passées sur la boutique publique — validation, préparation, livraison."
        breadcrumb="Commercial"
        action={
          enAttente > 0 ? (
            <Badge tone="amber" className="text-sm">
              <ShoppingBag size={14} /> {enAttente} en attente
            </Badge>
          ) : undefined
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="N°, nom ou téléphone…" />
        <Select value={statut} onChange={(e) => list.setFilter("statut", e.target.value)}>
          <option value="">Tous les statuts</option>
          {STATUTS.map((s) => (
            <option key={s} value={s}>{STATUT_LABELS[s as StatutCommande]}</option>
          ))}
        </Select>
        <Input type="date" value={String(list.filters.from ?? "")} onChange={(e) => list.setFilter("from", e.target.value)} />
        <Input type="date" value={String(list.filters.to ?? "")} onChange={(e) => list.setFilter("to", e.target.value)} />
      </div>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        error={errorMessage}
        rowKey={(c) => c.id}
        onRowClick={(c) => navigate(`/admin/commandes/${c.id}`)}
        page={list.page}
        onPageChange={list.setPage}
        emptyTitle="Aucune commande"
      />
    </>
  );
}
