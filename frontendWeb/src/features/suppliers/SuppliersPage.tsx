import { useState, type FormEvent } from "react";
import { ModuleTabs } from "@/components/ui";
import { APPRO_TABS } from "@/app/moduleTabs";
import { Plus, Power, Trash2 } from "lucide-react";
import type { Supplier } from "@/types";
import { fieldErrors, useCrud, useListState, usePaginated } from "@/lib/hooks";
import { Button, CardGrid, FormGrid, Input, Modal, PageHeader, SearchInput, Select, StatusBadge } from "@/components/ui";

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
      <CardGrid
        sansImage
        data={data}
        isLoading={isLoading}
        error={errorMessage}
        rowKey={(s) => s.id}
        page={list.page}
        onPageChange={list.setPage}
        onCardClick={open}
        emptyTitle="Aucun fournisseur"
        carte={(s) => ({
          initiale: s.name,
          badge: <StatusBadge status={s.status} />,
          titre: s.name,
          sousTitre: s.contact_name || "Aucun contact",
          details: [
            { label: "Téléphone", valeur: s.phone || "" },
            { label: "Email", valeur: s.email || "" },
          ],
          valeur: <span className="text-ge7-bronze">{s.purchases_count ?? 0} achat{(s.purchases_count ?? 0) > 1 ? "s" : ""}</span>,
          actions: (
            <>
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
            </>
          ),
        })}
      />
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
