import { useState, type FormEvent } from "react";
import { ModuleTabs } from "@/components/ui";
import { LOGISTIQUE_TABS } from "@/app/moduleTabs";
import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import type { Driver } from "@/types";
import { api, toApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { fieldErrors, useCrud, useListState, usePaginated } from "@/lib/hooks";
import { Button, DataTable, FormGrid, Input, Modal, PageHeader, SearchInput, Select, StatusBadge, type Column } from "@/components/ui";

type DriverForm = Partial<Omit<Driver, "id" | "code">> & { password?: string };

export function DriversPage() {
  const { user } = useAuth();
  // Consultation ouverte au CDG ; création/modification/suppression : LG, DG, SUPERADMIN.
  const peutGerer = hasRole(user, "LG_ADMIN", "DG_ADMIN");
  const list = useListState({ per_page: 20 });
  const drivers = usePaginated<Driver>("drivers", "/drivers", list.params);
  const crud = useCrud<Driver, DriverForm>("drivers", "/drivers");
  const [form, setForm] = useState<DriverForm | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [compte, setCompte] = useState<{ name: string; code: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null);
  const [formError, setFormError] = useState<unknown>(null);
  const errors = fieldErrors(crud.create.error ?? crud.update.error ?? formError);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setFormError(null);
    if (editId) {
      crud.update.mutateAsync({ id: editId, body: form })
        .then(() => { setForm(null); setEditId(null); })
        .catch(() => {});
      return;
    }
    // Création : la réponse contient le code de connexion du compte CHAUFFEUR.
    api.post<{ data: Driver; compte: { code: string } }>("/drivers", form)
      .then(({ data }) => {
        setCompte({ name: data.data.name, code: data.compte.code });
        crud.invalidate();
        setForm(null);
      })
      .catch((err) => setFormError(err));
  };

  const columns: Column<Driver>[] = [
    { key: "name", header: "Chauffeur", sortable: true, render: (d) => <span className="font-semibold">{d.name}</span> },
    { key: "phone", header: "Téléphone", render: (d) => d.phone },
    { key: "license_number", header: "Permis", render: (d) => d.license_number ?? "" },
    {
      key: "code",
      header: "Compte plateforme",
      render: (d) =>
        d.code ? (
          <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-emerald-700"><KeyRound size={13} /> {d.code}</span>
        ) : (
          <span className="text-ge7-black/40"></span>
        ),
    },
    { key: "status", header: "Statut", render: (d) => <StatusBadge status={d.status} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (d) =>
        peutGerer ? (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => { setEditId(d.id); setForm({ ...d }); }}><Pencil size={14} /></Button>
            <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(d)}><Trash2 size={14} className="text-rose-600" /></Button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <ModuleTabs tabs={LOGISTIQUE_TABS} />
      <PageHeader
        title="Chauffeurs"
        subtitle="Chaque chauffeur reçoit un compte pour suivre ses livraisons sur la plateforme."
        breadcrumb="Logistique"
        action={peutGerer ? <Button onClick={() => { setEditId(null); setFormError(null); setForm({ name: "", phone: "", license_number: "", status: "DISPONIBLE" }); }}><Plus size={16} /> Nouveau chauffeur</Button> : undefined}
      />
      <div className="mb-4 max-w-sm"><SearchInput value={list.search} onChange={list.setSearch} /></div>
      <DataTable columns={columns} data={drivers.data} isLoading={drivers.isLoading} error={drivers.errorMessage} rowKey={(d) => d.id} page={list.page} onPageChange={list.setPage} sort={list.sort} onSortChange={list.setSort} emptyTitle="Aucun chauffeur" />

      {form && (
        <Modal title={editId ? "Modifier le chauffeur" : "Nouveau chauffeur"} subtitle={editId ? undefined : "Un compte de connexion est créé automatiquement."} onClose={() => setForm(null)} footer={<><Button variant="secondary" onClick={() => setForm(null)}>Annuler</Button><Button type="submit" form="drv-form" loading={crud.create.isPending || crud.update.isPending}>Enregistrer</Button></>}>
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
              <Input
                label={editId ? "Nouveau mot de passe (optionnel)" : "Mot de passe du compte"}
                type="password"
                required={!editId}
                minLength={8}
                value={form.password ?? ""}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                error={errors.password}
                hint={editId ? "Laisser vide pour conserver le mot de passe actuel" : "8 caractères minimum — le code de connexion sera affiché après création"}
              />
            </FormGrid>
            {formError ? <p className="mt-3 text-sm font-medium text-rose-600">{toApiError(formError).message}</p> : null}
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="Supprimer le chauffeur"
          size="sm"
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Annuler</Button>
              <Button variant="danger" loading={crud.remove.isPending} onClick={() => crud.remove.mutateAsync(deleteTarget.id).then(() => setDeleteTarget(null)).catch(() => {})}>Supprimer</Button>
            </>
          }
        >
          <p className="text-sm text-ge7-black/80">
            Supprimer <span className="font-semibold">{deleteTarget.name}</span> ? Son compte de connexion sera supprimé aussi, il ne pourra plus se connecter. Une livraison en cours bloque la suppression.
          </p>
          {crud.remove.isError && <p className="mt-3 text-sm font-medium text-rose-600">{toApiError(crud.remove.error).message}</p>}
        </Modal>
      )}

      {compte && (
        <Modal title="Compte chauffeur créé" size="sm" onClose={() => setCompte(null)} footer={<Button onClick={() => setCompte(null)}>OK</Button>}>
          <p className="text-sm">Communiquez ces identifiants à <strong>{compte.name}</strong> — il se connecte via le bouton « Connexion » de la plateforme :</p>
          <dl className="mt-3 space-y-2 rounded-2xl bg-ge7-cream p-4 text-sm">
            <div className="flex justify-between"><dt className="text-ge7-black/60">Code de connexion</dt><dd className="font-mono text-lg font-extrabold tracking-widest">{compte.code}</dd></div>
            <div className="flex justify-between"><dt className="text-ge7-black/60">Mot de passe</dt><dd>celui que vous venez de saisir</dd></div>
          </dl>
        </Modal>
      )}
    </>
  );
}
