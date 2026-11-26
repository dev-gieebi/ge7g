import { useNavigate } from "react-router-dom";
import { ClipboardPlus } from "lucide-react";
import { ModuleTabs, Badge, Button, DataTable, PageHeader, SearchInput, Select, type Column } from "@/components/ui";
import { APPRO_TABS } from "@/app/moduleTabs";
import { useListState, usePaginated } from "@/lib/hooks";
import { datetime } from "@/lib/format";
import type { Inventaire } from "@/types";

export function StatutInventaire({ statut }: { statut: Inventaire["statut"] }) {
  return statut === "VALIDE" ? <Badge tone="green">Validé</Badge> : <Badge tone="amber">Brouillon</Badge>;
}

/** Liste des inventaires physiques (brouillons en cours et inventaires validés). */
export function InventairesPage() {
  const navigate = useNavigate();
  const list = useListState({ per_page: 20 });
  const q = usePaginated<Inventaire>("inventaires", "/inventaires", list.params);

  const columns: Column<Inventaire>[] = [
    { key: "numero", header: "N°", render: (i) => <span className="font-mono font-bold">{i.numero}</span> },
    { key: "created_at", header: "Créé le", render: (i) => datetime(i.created_at) },
    { key: "statut", header: "Statut", render: (i) => <StatutInventaire statut={i.statut} /> },
    { key: "lignes", header: "Articles comptés", align: "right", render: (i) => i.lignes_count ?? 0 },
    {
      key: "ecarts",
      header: "Écarts",
      align: "right",
      render: (i) => (i.statut === "VALIDE" ? <span className={i.ecarts_count ? "font-bold text-rose-600" : "text-emerald-700"}>{i.ecarts_count ?? 0}</span> : <span className="text-ge7-black/30">—</span>),
    },
    { key: "user", header: "Par", render: (i) => i.user?.name ?? "" },
    { key: "valide_le", header: "Validé le", render: (i) => (i.valide_le ? `${datetime(i.valide_le)}${i.valide_par ? ` · ${i.valide_par.name}` : ""}` : "") },
  ];

  return (
    <>
      <ModuleTabs tabs={APPRO_TABS} />
      <PageHeader
        title="Inventaires"
        breadcrumb="Approvisionnement"
        subtitle="Comptez les articles en magasin : à la validation, les écarts avec le stock physique apparaissent dans l'état du stock."
        action={
          <Button onClick={() => navigate("/admin/inventaires/nouveau")}>
            <ClipboardPlus size={16} /> Nouvel inventaire
          </Button>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="N°, notes…" className="sm:col-span-2" />
        <Select value={String(list.filters.statut ?? "")} onChange={(e) => list.setFilter("statut", e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="BROUILLON">Brouillons</option>
          <option value="VALIDE">Validés</option>
        </Select>
      </div>
      <DataTable
        columns={columns}
        data={q.data}
        isLoading={q.isLoading}
        error={q.errorMessage}
        rowKey={(i) => i.id}
        onRowClick={(i) => navigate(`/admin/inventaires/${i.id}`)}
        page={list.page}
        onPageChange={list.setPage}
        emptyTitle="Aucun inventaire"
        emptyHint="Créez un inventaire pour saisir vos comptages."
      />
    </>
  );
}
