import { useState, type FormEvent } from "react";
import { ModuleTabs } from "@/components/ui";
import { CATALOGUE_TABS } from "@/app/moduleTabs";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { Category } from "@/types";
import { fieldErrors, useCrud, useListState, usePaginated } from "@/lib/hooks";
import { Button, DataTable, FormGrid, Input, Modal, PageHeader, SearchInput, type Column } from "@/components/ui";

type Form = Partial<Omit<Category, "id" | "products_count">>;

export function CategoriesPage() {
  const list = useListState({ per_page: 30 });
  const { data, isLoading, errorMessage } = usePaginated<Category>("categories", "/categories", list.params);
  const crud = useCrud<Category, Form>("categories", "/categories");
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

  const columns: Column<Category>[] = [
    { key: "name", header: "Catégorie", sortable: true, render: (c) => <span className="font-semibold">{c.name}</span> },
    { key: "products_count", header: "Produits", align: "center", render: (c) => c.products_count ?? 0 },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (c) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => open(c)}><Pencil size={14} /></Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={(c.products_count ?? 0) > 0}
            title={(c.products_count ?? 0) > 0 ? "Catégorie utilisée" : "Supprimer"}
            onClick={() => confirm(`Supprimer « ${c.name} » ?`) && crud.remove.mutate(c.id)}
          >
            <Trash2 size={14} className="text-rose-600" />
          </Button>
        </div>
      ),
    },
  ];

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
      <DataTable columns={columns} data={data} isLoading={isLoading} error={errorMessage} rowKey={(c) => c.id} page={list.page} onPageChange={list.setPage} sort={list.sort} onSortChange={list.setSort} emptyTitle="Aucune catégorie" />

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
