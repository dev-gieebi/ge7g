import { useState, type FormEvent } from "react";
import { ModuleTabs } from "@/components/ui";
import { COMMERCIAL_TABS } from "@/app/moduleTabs";
import { useNavigate } from "react-router-dom";
import { Plus, UserX, Pencil } from "lucide-react";
import type { Client, Zone } from "@/types";
import { useCrud, useListState, usePaginated, fieldErrors } from "@/lib/hooks";
import { useZones } from "@/features/shared/refData";
import {
  Button,
  DataTable,
  FormGrid,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  StatusBadge,
  type Column,
} from "@/components/ui";
import { date } from "@/lib/format";

type ClientForm = Omit<Partial<Client>, "id" | "zone" | "created_at">;

const empty: ClientForm = {
  company_name: "",
  contact_name: "",
  phone: "",
  email: "",
  address: "",
  zone_id: null,
  client_type: "ENTREPRISE",
  status: "ACTIF",
};

export function ClientsPage() {
  const navigate = useNavigate();
  const list = useListState({ per_page: 15 });
  const { data, isLoading, errorMessage } = usePaginated<Client>("clients", "/clients", list.params);
  const crud = useCrud<Client, ClientForm>("clients", "/clients");
  const { data: zones } = useZones();
  const [editing, setEditing] = useState<ClientForm | null>(null);
  const [editId, setEditId] = useState<number | null>(null);

  const open = (c?: Client) => {
    setEditId(c?.id ?? null);
    setEditing(c ? { ...c } : { ...empty });
  };
  const close = () => {
    setEditing(null);
    setEditId(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (editId) await crud.update.mutateAsync({ id: editId, body: editing }).then(close).catch(() => {});
    else await crud.create.mutateAsync(editing).then(close).catch(() => {});
  };
  const errors = fieldErrors(crud.create.error ?? crud.update.error);

  const columns: Column<Client>[] = [
    { key: "company_name", header: "Client", sortable: true, render: (c) => <span className="font-semibold">{c.company_name}</span> },
    { key: "contact_name", header: "Contact", render: (c) => c.contact_name },
    { key: "phone", header: "Téléphone", render: (c) => c.phone },
    { key: "zone", header: "Zone", render: (c) => c.zone?.name ?? "—" },
    { key: "client_type", header: "Type", render: (c) => <StatusBadge status={c.client_type} /> },
    { key: "chantiers_count", header: "Chantiers", align: "center", render: (c) => c.chantiers_count ?? 0 },
    { key: "orders_count", header: "Commandes", align: "center", render: (c) => c.orders_count ?? 0 },
    { key: "status", header: "Statut", render: (c) => <StatusBadge status={c.status} /> },
    { key: "created_at", header: "Créé le", sortable: true, render: (c) => date(c.created_at) },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (c) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => open(c)} title="Modifier">
            <Pencil size={14} />
          </Button>
          {c.status === "ACTIF" && (
            <Button
              size="sm"
              variant="ghost"
              title="Désactiver"
              onClick={() => crud.update.mutate({ id: c.id, body: { status: "INACTIF" } })}
            >
              <UserX size={14} className="text-rose-600" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <ModuleTabs tabs={COMMERCIAL_TABS} />
      <PageHeader
        title="Clients"
        subtitle="Entreprises et particuliers, leurs chantiers et leur historique."
        breadcrumb="Commercial"
        action={
          <Button onClick={() => open()}>
            <Plus size={16} /> Nouveau client
          </Button>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="Nom, contact, téléphone…" />
        <Select value={String(list.filters.zone_id ?? "")} onChange={(e) => list.setFilter("zone_id", e.target.value)}>
          <option value="">Toutes les zones</option>
          {zones?.map((z: Zone) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </Select>
        <Select value={String(list.filters.status ?? "")} onChange={(e) => list.setFilter("status", e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="ACTIF">Actif</option>
          <option value="INACTIF">Inactif</option>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        error={errorMessage}
        rowKey={(c) => c.id}
        onRowClick={(c) => navigate(`/clients/${c.id}`)}
        page={list.page}
        onPageChange={list.setPage}
        sort={list.sort}
        onSortChange={list.setSort}
        emptyTitle="Aucun client"
        emptyHint="Créez votre premier client pour démarrer."
      />

      {editing && (
        <Modal
          title={editId ? "Modifier le client" : "Nouveau client"}
          onClose={close}
          footer={
            <>
              <Button variant="secondary" onClick={close}>
                Annuler
              </Button>
              <Button type="submit" form="client-form" loading={crud.create.isPending || crud.update.isPending}>
                Enregistrer
              </Button>
            </>
          }
        >
          <form id="client-form" onSubmit={submit}>
            <FormGrid>
              <Input label="Nom entreprise / client" required value={editing.company_name ?? ""} onChange={(e) => setEditing({ ...editing, company_name: e.target.value })} error={errors.company_name} className="sm:col-span-2" />
              <Input label="Contact" value={editing.contact_name ?? ""} onChange={(e) => setEditing({ ...editing, contact_name: e.target.value })} error={errors.contact_name} />
              <Input label="Téléphone" value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} error={errors.phone} />
              <Input label="Email" type="email" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} error={errors.email} />
              <Select label="Type" value={editing.client_type} onChange={(e) => setEditing({ ...editing, client_type: e.target.value as Client["client_type"] })}>
                <option value="ENTREPRISE">Entreprise</option>
                <option value="PARTICULIER">Particulier</option>
              </Select>
              <Input label="Adresse" value={editing.address ?? ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} error={errors.address} className="sm:col-span-2" />
              <Select label="Zone" value={String(editing.zone_id ?? "")} onChange={(e) => setEditing({ ...editing, zone_id: e.target.value ? Number(e.target.value) : null })} error={errors.zone_id}>
                <option value="">—</option>
                {zones?.map((z: Zone) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </Select>
              <Select label="Statut" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as Client["status"] })}>
                <option value="ACTIF">Actif</option>
                <option value="INACTIF">Inactif</option>
              </Select>
            </FormGrid>
          </form>
        </Modal>
      )}
    </>
  );
}
