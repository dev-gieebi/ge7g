import { useState, type FormEvent } from "react";
import { ModuleTabs } from "@/components/ui";
import { LOGISTIQUE_TABS } from "@/app/moduleTabs";
import { Pencil, Plus } from "lucide-react";
import type { Vehicle } from "@/types";
import { fieldErrors, useCrud, useListState, usePaginated } from "@/lib/hooks";
import { Button, DataTable, FormGrid, Input, Modal, PageHeader, SearchInput, Select, StatusBadge, type Column } from "@/components/ui";

type VehicleForm = Partial<Omit<Vehicle, "id">>;

export function VehiclesPage() {
  const list = useListState({ per_page: 20 });
  const vehicles = usePaginated<Vehicle>("vehicles", "/vehicles", list.params);
  const crud = useCrud<Vehicle, VehicleForm>("vehicles", "/vehicles");
  const [form, setForm] = useState<VehicleForm | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const errors = fieldErrors(crud.create.error ?? crud.update.error);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    (editId ? crud.update.mutateAsync({ id: editId, body: form }) : crud.create.mutateAsync(form))
      .then(() => { setForm(null); setEditId(null); })
      .catch(() => {});
  };

  const columns: Column<Vehicle>[] = [
    { key: "plate", header: "Immatriculation", sortable: true, render: (v) => <span className="font-semibold">{v.plate}</span> },
    { key: "model", header: "Modèle", render: (v) => v.model },
    { key: "capacity", header: "Capacité", render: (v) => v.capacity ?? "—" },
    { key: "status", header: "Statut", render: (v) => <StatusBadge status={v.status} /> },
    { key: "actions", header: "", align: "right", render: (v) => <Button size="sm" variant="ghost" onClick={() => { setEditId(v.id); setForm({ ...v }); }}><Pencil size={14} /></Button> },
  ];

  return (
    <>
      <ModuleTabs tabs={LOGISTIQUE_TABS} />
      <PageHeader
        title="Véhicules"
        subtitle="Flotte de véhicules affectée aux missions de livraison."
        breadcrumb="Logistique"
        action={<Button onClick={() => { setEditId(null); setForm({ plate: "", model: "", capacity: "", status: "DISPONIBLE" }); }}><Plus size={16} /> Nouveau véhicule</Button>}
      />
      <div className="mb-4 max-w-sm"><SearchInput value={list.search} onChange={list.setSearch} /></div>
      <DataTable columns={columns} data={vehicles.data} isLoading={vehicles.isLoading} error={vehicles.errorMessage} rowKey={(v) => v.id} page={list.page} onPageChange={list.setPage} sort={list.sort} onSortChange={list.setSort} emptyTitle="Aucun véhicule" />

      {form && (
        <Modal title={editId ? "Modifier le véhicule" : "Nouveau véhicule"} size="sm" onClose={() => setForm(null)} footer={<><Button variant="secondary" onClick={() => setForm(null)}>Annuler</Button><Button type="submit" form="veh-form" loading={crud.create.isPending || crud.update.isPending}>Enregistrer</Button></>}>
          <form id="veh-form" onSubmit={submit}>
            <FormGrid cols={1}>
              <Input label="Immatriculation" required value={form.plate ?? ""} onChange={(e) => setForm({ ...form, plate: e.target.value })} error={errors.plate} />
              <Input label="Modèle" required value={form.model ?? ""} onChange={(e) => setForm({ ...form, model: e.target.value })} error={errors.model} />
              <Input label="Capacité" placeholder="ex. 10 tonnes" value={form.capacity ?? ""} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
              <Select label="Statut" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Vehicle["status"] })}>
                <option value="DISPONIBLE">Disponible</option>
                <option value="EN_MISSION">En mission</option>
                <option value="MAINTENANCE">Maintenance</option>
              </Select>
            </FormGrid>
          </form>
        </Modal>
      )}
    </>
  );
}
