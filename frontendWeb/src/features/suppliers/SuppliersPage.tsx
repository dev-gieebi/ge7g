import { useState, type FormEvent } from "react";
import { ModuleTabs } from "@/components/ui";
import { APPRO_TABS } from "@/app/moduleTabs";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import type { Supplier } from "@/types";
import { fieldErrors, useCrud, useListState, usePaginated } from "@/lib/hooks";
import { Button, DataTable, FormGrid, Input, Modal, PageHeader, SearchInput, Select, StatusBadge, type Column } from "@/components/ui";

type Form = Partial<Omit<Supplier, "id" | "purchases_count">>;
const empty: Form = { name: "", contact_name: "", phone: "", email: "", address: "" };

export function SuppliersPage() {
  const list = useListState({ per_page: 15 });
  const { data, isLoading, errorMessage } = usePaginated<Supplier>("suppliers", "/suppliers", list.params);
  const crud = useCrud<Supplier, Form>("suppliers", "/suppliers");
  const [editing, setEditing] = useState<Form | null>(null);
  const [editId, setEditId] = useState<number | null>(null);

  const open = (s?: Supplier) => { setEditId(s?.id ?? null); setEditing(s ? { ...s } : { ...empty }); };
  const close = () => { setEditing(null); setEditId(null); };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    (editId ? crud.update.mutateAsync({ id: editId, body: editing }) : crud.create.mutateAsync(editing)).then(close).catch(() => {});
  };
  const errors = fieldErrors(crud.create.error ?? crud.update.error);

  const columns: Column<Supplier>[] = [
    { key: "name", header: "Fournisseur", sortable: true, render: (s) => <span className="font-semibold">{s.name}</span> },
    { key: "contact_name", header: "Contact", render: (s) => s.contact_name },
    { key: "phone", header: "Téléphone", render: (s) => s.phone },
    { key: "email", header: "Email", render: (s) => s.email },
    { key: "purchases_count", header: "Achats", align: "center", render: (s) => s.purchases_count ?? 0 },
    { key: "status", header: "Statut", render: (s) => <StatusBadge status={s.status} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (s) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" title="Modifier" onClick={() => open(s)}><Pencil size={14} /></Button>
          <Button
            size="sm"
            variant="ghost"
            title={s.status === "ACTIF" ? "Désactiver" : "Activer"}
            onClick={() => {
              const { id: _, purchases_count: __, ...body } = s;
              crud.update.mutate({ id: s.id, body: { ...body, status: s.status === "ACTIF" ? "INACTIF" : "ACTIF" } });
            }}
          >
            <Power size={14} className={s.status === "ACTIF" ? "text-rose-600" : "text-emerald-600"} />
          </Button>
          <Button size="sm" variant="ghost" title="Supprimer" onClick={() => confirm(`Supprimer « ${s.name} » ?`) && crud.remove.mutate(s.id)}>
            <Trash2 size={14} className="text-rose-600" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <ModuleTabs tabs={APPRO_TABS} />
      <PageHeader title="Fournisseurs" subtitle="Coordonnées, produits fournis et historique des achats." breadcrumb="Approvisionnement" action={<Button onClick={() => open()}><Plus size={16} /> Nouveau fournisseur</Button>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="Nom, contact, email…" className="sm:col-span-2" />
        <Select value={String(list.filters.status ?? "")} onChange={(e) => list.setFilter("status", e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="ACTIF">Actif</option>
          <option value="INACTIF">Inactif</option>
        </Select>
      </div>
      <DataTable columns={columns} data={data} isLoading={isLoading} error={errorMessage} rowKey={(s) => s.id} page={list.page} onPageChange={list.setPage} sort={list.sort} onSortChange={list.setSort} emptyTitle="Aucun fournisseur" />
      {editing && (
        <Modal title={editId ? "Modifier le fournisseur" : "Nouveau fournisseur"} onClose={close} footer={<><Button variant="secondary" onClick={close}>Annuler</Button><Button type="submit" form="sup-form" loading={crud.create.isPending || crud.update.isPending}>Enregistrer</Button></>}>
          <form id="sup-form" onSubmit={submit}>
            <FormGrid>
              <Input label="Nom" required value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} error={errors.name} className="sm:col-span-2" />
              <Input label="Contact" value={editing.contact_name ?? ""} onChange={(e) => setEditing({ ...editing, contact_name: e.target.value })} error={errors.contact_name} />
              <Input label="Téléphone" value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} error={errors.phone} />
              <Input label="Email" type="email" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} error={errors.email} />
              <Input label="Adresse" value={editing.address ?? ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} error={errors.address} />
            </FormGrid>
          </form>
        </Modal>
      )}
    </>
  );
}
