import { useState, type FormEvent } from "react";
import { ModuleTabs } from "@/components/ui";
import { LOGISTIQUE_TABS } from "@/app/moduleTabs";
import { Pencil, Plus } from "lucide-react";
import type { Driver } from "@/types";
import { fieldErrors, useCrud, useListState, usePaginated } from "@/lib/hooks";
import { Button, DataTable, FormGrid, Input, Modal, PageHeader, SearchInput, Select, StatusBadge, type Column } from "@/components/ui";

type DriverForm = Partial<Omit<Driver, "id">> & { email?: string; password?: string };

export function DriversPage() {
  const list = useListState({ per_page: 20 });
  const drivers = usePaginated<Driver>("drivers", "/drivers", list.params);
  const crud = useCrud<Driver, DriverForm>("drivers", "/drivers");
  const [form, setForm] = useState<DriverForm | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const errors = fieldErrors(crud.create.error ?? crud.update.error);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    (editId ? crud.update.mutateAsync({ id: editId, body: form }) : crud.create.mutateAsync(form))
      .then(() => { setForm(null); setEditId(null); })
      .catch(() => {});
  };

  const columns: Column<Driver>[] = [
    { key: "name", header: "Chauffeur", sortable: true, render: (d) => <span className="font-semibold">{d.name}</span> },
    { key: "phone", header: "Téléphone", render: (d) => d.phone },
    { key: "license_number", header: "Permis", render: (d) => d.license_number ?? "—" },
    { key: "user", header: "Compte mobile", render: (d) => (d.user_id ? <span className="text-emerald-700">Oui</span> : <span className="text-ge7-black/40">Non</span>) },
    { key: "status", header: "Statut", render: (d) => <StatusBadge status={d.status} /> },
    { key: "actions", header: "", align: "right", render: (d) => <Button size="sm" variant="ghost" onClick={() => { setEditId(d.id); setForm({ ...d }); }}><Pencil size={14} /></Button> },
  ];

  return (
    <>
      <ModuleTabs tabs={LOGISTIQUE_TABS} />
      <PageHeader
        title="Chauffeurs"
        subtitle="Chauffeurs G7 Energy — ils réalisent leurs missions via l'application mobile."
        breadcrumb="Logistique"
        action={<Button onClick={() => { setEditId(null); setForm({ name: "", phone: "", license_number: "", status: "DISPONIBLE" }); }}><Plus size={16} /> Nouveau chauffeur</Button>}
      />
      <div className="mb-4 max-w-sm"><SearchInput value={list.search} onChange={list.setSearch} /></div>
      <DataTable columns={columns} data={drivers.data} isLoading={drivers.isLoading} error={drivers.errorMessage} rowKey={(d) => d.id} page={list.page} onPageChange={list.setPage} sort={list.sort} onSortChange={list.setSort} emptyTitle="Aucun chauffeur" />

      {form && (
        <Modal title={editId ? "Modifier le chauffeur" : "Nouveau chauffeur"} onClose={() => setForm(null)} footer={<><Button variant="secondary" onClick={() => setForm(null)}>Annuler</Button><Button type="submit" form="drv-form" loading={crud.create.isPending || crud.update.isPending}>Enregistrer</Button></>}>
          <form id="drv-form" onSubmit={submit}>
            <FormGrid>
              <Input label="Nom complet" required value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
              <Input label="Téléphone" required value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} />
              <Input label="N° permis" value={form.license_number ?? ""} onChange={(e) => setForm({ ...form, license_number: e.target.value })} error={errors.license_number} />
              <Select label="Statut" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Driver["status"] })}>
                <option value="DISPONIBLE">Disponible</option>
                <option value="EN_MISSION">En mission</option>
                <option value="INDISPONIBLE">Indisponible</option>
              </Select>
              {!editId && (
                <>
                  <Input label="Email (compte app mobile)" type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} />
                  <Input label="Mot de passe initial" type="password" value={form.password ?? ""} onChange={(e) => setForm({ ...form, password: e.target.value })} error={errors.password} hint="Optionnel : crée un accès CHAUFFEUR (mobile)" />
                </>
              )}
            </FormGrid>
          </form>
        </Modal>
      )}
    </>
  );
}
