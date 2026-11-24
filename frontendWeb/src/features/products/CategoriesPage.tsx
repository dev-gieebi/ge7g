import { useState, type FormEvent } from "react";
import { ModuleTabs } from "@/components/ui";
import { CATALOGUE_TABS } from "@/app/moduleTabs";
import { Plus, Trash2 } from "lucide-react";
import type { Category } from "@/types";
import { fieldErrors, useCrud, useListState, usePaginated } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import { useConfirmer } from "@/lib/confirmation";
import { Button, CardGrid, FormGrid, Input, Modal, PageHeader, SearchInput } from "@/components/ui";

type Form = Partial<Omit<Category, "id" | "products_count">>;

export function CategoriesPage() {
  const list = useListState({ per_page: 30 });
  const { data, isLoading, errorMessage } = usePaginated<Category>("categories", "/categories", list.params);
  const crud = useCrud<Category, Form>("categories", "/categories");
  const { user } = useAuth();
  const estSuperAdmin = user?.role === "SUPERADMIN";
  const confirmer = useConfirmer();
  const [editing, setEditing] = useState<Form | null>(null);
  const [editId, setEditId] = useState<number | null>(null);

  const open = (c?: Category) => {
    setEditId(c?.id ?? null);
    setEditing(c ? { ...c } : { name: "" });
  };
  const close = () => {
    setEditing(null);
    setEditId(null);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    (editId ? crud.update.mutateAsync({ id: editId, body: editing }) : crud.create.mutateAsync(editing)).then(close).catch(() => {});
  };
  const errors = fieldErrors(crud.create.error ?? crud.update.error);

  return (
    <>
      <ModuleTabs tabs={CATALOGUE_TABS} />
      <PageHeader
        title="Catégories"
        subtitle="Catégories du catalogue (ex. Fer, Groupe électrogène, Ciment…)."
        breadcrumb="Catalogue"
        action={<Button onClick={() => open()}><Plus size={16} /> Nouvelle catégorie</Button>}
      />
      <div className="mb-4 max-w-sm">
        <SearchInput value={list.search} onChange={list.setSearch} />
      </div>
      <CardGrid
        sansImage
        data={data}
        isLoading={isLoading}
        error={errorMessage}
        rowKey={(c) => c.id}
        page={list.page}
        onPageChange={list.setPage}
        onCardClick={open}
        emptyTitle="Aucune catégorie"
        carte={(c) => ({
          initiale: c.name,
          titre: c.name,
          valeur: <span className="text-ge7-bronze">{c.products_count ?? 0} produit{(c.products_count ?? 0) > 1 ? "s" : ""}</span>,
          // Suppression : Super admin uniquement, jamais une catégorie liée à des produits.
          actions: estSuperAdmin ? (
            <Button
              size="sm"
              variant="ghost"
              title="Supprimer"
              onClick={async () => {
                const n = c.products_count ?? 0;
                if (n > 0) {
                  await confirmer({ titre: "Impossible de supprimer", message: <>La catégorie <b>« {c.name} »</b> est liée à <b>{n} produit{n > 1 ? "s" : ""}</b>. Changez d'abord la catégorie de ces produits.</>, seulementOk: true });
                  return;
                }
                if (await confirmer({ titre: "Supprimer la catégorie ?", message: <>Voulez-vous vraiment supprimer la catégorie <b>« {c.name} »</b> ?</>, bouton: "Supprimer" })) crud.remove.mutate(c.id);
              }}
            >
              <Trash2 size={14} className="text-rose-600" />
            </Button>
          ) : undefined,
        })}
      />

      {editing && (
        <Modal
          title={editId ? "Modifier la catégorie" : "Nouvelle catégorie"}
          size="sm"
          onClose={close}
          footer={
            <>
              <Button variant="secondary" onClick={close}>Annuler</Button>
              <Button type="submit" form="cat-form" loading={crud.create.isPending || crud.update.isPending}>Enregistrer</Button>
            </>
          }
        >
          <form id="cat-form" onSubmit={submit}>
            <FormGrid cols={1}>
              <Input label="Nom" required value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} error={errors.name} />
            </FormGrid>
          </form>
        </Modal>
      )}
    </>
  );
}
