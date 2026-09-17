import { useState, type FormEvent } from "react";
import { ModuleTabs } from "@/components/ui";
import { CATALOGUE_TABS } from "@/app/moduleTabs";
import { Pencil, Plus } from "lucide-react";
import type { Category, Product, Unit } from "@/types";
import { fieldErrors, useCrud, useListState, usePaginated } from "@/lib/hooks";
import { useCategories, useUnits } from "@/features/shared/refData";
import { qty } from "@/lib/format";
import {
  Badge,
  Button,
  DataTable,
  FormGrid,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  type Column,
} from "@/components/ui";

type ProductForm = Partial<Omit<Product, "id" | "category" | "unit">>;

const empty: ProductForm = {
  reference: "",
  name: "",
  category_id: undefined,
  type: "",
  unit_id: undefined,
  sale_price: 0,
  purchase_price: 0,
  min_stock: 0,
  image_url: null,
};

export function stockTone(p: Pick<Product, "available_quantity" | "min_stock">) {
  if (p.available_quantity <= 0) return { tone: "red" as const, label: "Rupture" };
  if (p.available_quantity <= p.min_stock) return { tone: "amber" as const, label: "Stock faible" };
  return { tone: "green" as const, label: "Disponible" };
}

export function ProductsPage() {
  const list = useListState({ per_page: 20 });
  const { data, isLoading, errorMessage } = usePaginated<Product>("products", "/products", list.params);
  const crud = useCrud<Product, ProductForm>("products", "/products");
  const { data: categories } = useCategories();
  const { data: units } = useUnits();
  const [editing, setEditing] = useState<ProductForm | null>(null);
  const [editId, setEditId] = useState<number | null>(null);

  const open = (p?: Product) => {
    setEditId(p?.id ?? null);
    setEditing(p ? { ...p } : { ...empty });
  };
  const close = () => {
    setEditing(null);
    setEditId(null);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const action = editId ? crud.update.mutateAsync({ id: editId, body: editing }) : crud.create.mutateAsync(editing);
    action.then(close).catch(() => {});
  };
  const errors = fieldErrors(crud.create.error ?? crud.update.error);

  const columns: Column<Product>[] = [
    { key: "reference", header: "Référence", sortable: true, render: (p) => (
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-ge7-gold-soft text-xs font-bold text-ge7-bronze">
            {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" /> : p.name.slice(0, 2).toUpperCase()}
          </div>
          <p className="font-mono text-xs font-bold">{p.reference}</p>
        </div>
      ),
    },
    {
      key: "name",
      header: "Désignation",
      sortable: true,
      render: (p) => <span className="font-semibold">{p.name}</span>,
    },
    { key: "category", header: "Catégorie", render: (p) => p.category?.name ?? "—" },
    { key: "stock", header: "Stock dispo", align: "right", render: (p) => qty(p.available_quantity, p.unit?.symbol) },
    { key: "min_stock", header: "Stock minimum", align: "right", render: (p) => qty(p.min_stock, p.unit?.symbol) },
    {
      key: "alert",
      header: "État",
      render: (p) => {
        const s = stockTone(p);
        return <Badge tone={s.tone}>{s.label}</Badge>;
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (p) => (
        <Button size="sm" variant="ghost" onClick={() => open(p)}>
          <Pencil size={14} />
        </Button>
      ),
    },
  ];

  return (
    <>
      <ModuleTabs tabs={CATALOGUE_TABS} />
      <PageHeader
        title="Produits"
        subtitle="Catalogue, références, unités, prix et niveaux de stock."
        breadcrumb="Catalogue"
        action={
          <Button onClick={() => open()}>
            <Plus size={16} /> Nouveau produit
          </Button>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="Nom, référence, type…" className="sm:col-span-2" />
        <Select value={String(list.filters.category_id ?? "")} onChange={(e) => list.setFilter("category_id", e.target.value)}>
          <option value="">Toutes les catégories</option>
          {categories?.map((c: Category) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Select value={String(list.filters.alert ?? "")} onChange={(e) => list.setFilter("alert", e.target.value)}>
          <option value="">Tous les états</option>
          <option value="low">Stock faible</option>
          <option value="out">Rupture</option>
        </Select>
      </div>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        error={errorMessage}
        rowKey={(p) => p.id}
        page={list.page}
        onPageChange={list.setPage}
        sort={list.sort}
        onSortChange={list.setSort}
        emptyTitle="Aucun produit"
      />

      {editing && (
        <Modal
          title={editId ? "Modifier le produit" : "Nouveau produit"}
          size="lg"
          onClose={close}
          footer={
            <>
              <Button variant="secondary" onClick={close}>Annuler</Button>
              <Button type="submit" form="product-form" loading={crud.create.isPending || crud.update.isPending}>Enregistrer</Button>
            </>
          }
        >
          <form id="product-form" onSubmit={submit}>
            <FormGrid cols={3}>
              <Input label="Référence" value={editing.reference ?? ""} onChange={(e) => setEditing({ ...editing, reference: e.target.value })} error={errors.reference} />
              <Input label="Désignation" required value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} error={errors.name} className="sm:col-span-2" />
              <Select label="Catégorie" required value={String(editing.category_id ?? "")} onChange={(e) => setEditing({ ...editing, category_id: e.target.value ? Number(e.target.value) : undefined })} error={errors.category_id}>
                <option value="">Choisir une catégorie</option>
                {categories?.map((c: Category) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              <Select label="Unité" required value={String(editing.unit_id ?? "")} onChange={(e) => setEditing({ ...editing, unit_id: e.target.value ? Number(e.target.value) : undefined })} error={errors.unit_id}>
                <option value="">Choisir une unité</option>
                {units?.map((u: Unit) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
                ))}
              </Select>
              <Input label="Stock minimum" type="number" min={0} value={editing.min_stock ?? 0} onChange={(e) => setEditing({ ...editing, min_stock: Number(e.target.value) })} error={errors.min_stock} />
              <div className="sm:col-span-2">
                <span className="mb-1.5 block text-sm font-semibold text-ge7-black/80">Image</span>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-ge7-black/20 bg-white px-3 py-2.5 transition hover:border-ge7-gold">
                  {editing.image_url ? (
                    <img src={editing.image_url} alt="" className="size-10 rounded-lg object-cover" />
                  ) : (
                    <span className="grid size-10 place-items-center rounded-lg bg-ge7-gold-soft text-xs font-bold text-ge7-bronze">IMG</span>
                  )}
                  <span className="text-sm text-ge7-black/60">{editing.image_url ? "Changer l'image" : "Choisir une image…"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => setEditing({ ...editing, image_url: String(reader.result) });
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              </div>
            </FormGrid>
            {!editId && (
              <p className="mt-4 rounded-xl bg-ge7-purple-soft px-4 py-3 text-xs text-ge7-purple">
                Les prix se gèrent dans l'onglet <strong>Prix / Barème</strong> et le stock via les <strong>réceptions d'achats</strong>.
              </p>
            )}
          </form>
        </Modal>
      )}
    </>
  );
}
