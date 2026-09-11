import { useState, type FormEvent, type ReactNode } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { fieldErrors, useCrud, useListState, usePaginated } from "@/lib/hooks";
import { Button, DataTable, FormGrid, Input, Modal, SearchInput, Select, type Column } from "@/components/ui";

export interface Field<T> {
  name: keyof T & string;
  label: string;
  type?: "text" | "number" | "email" | "password" | "select" | "checkbox";
  options?: { value: string | number; label: string }[];
  required?: boolean;
  step?: string;
  hint?: string;
  hideOnEdit?: boolean;
  span?: 1 | 2;
}

export function SimpleCrud<T extends { id: number }>({
  queryKey,
  url,
  title,
  columns,
  fields,
  empty,
  allowDelete,
  searchable = true,
  extraActions,
}: {
  queryKey: string;
  url: string;
  title: string;
  columns: Column<T>[];
  fields: Field<T>[];
  empty: Partial<T>;
  allowDelete?: (row: T) => boolean;
  searchable?: boolean;
  extraActions?: (row: T) => ReactNode;
}) {
  const list = useListState({ per_page: 20 });
  const { data, isLoading, errorMessage } = usePaginated<T>(queryKey, url, list.params);
  const crud = useCrud<T, Partial<T>>(queryKey, url);
  const [form, setForm] = useState<Partial<T> | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);
  const errors = fieldErrors(crud.create.error ?? crud.update.error);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    (editId ? crud.update.mutateAsync({ id: editId, body: form }) : crud.create.mutateAsync(form)).then(() => { setForm(null); setEditId(null); }).catch(() => {});
  };

  const cols: Column<T>[] = [
    ...columns,
    {
      key: "__actions",
      header: "",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          {extraActions?.(row)}
          <Button size="sm" variant="ghost" onClick={() => { setEditId(row.id); setForm({ ...row }); }}><Pencil size={14} /></Button>
          {allowDelete?.(row) && <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(row)}><Trash2 size={14} className="text-rose-600" /></Button>}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold">{title}</h3>
        <div className="flex items-center gap-2">
          {searchable && <SearchInput value={list.search} onChange={list.setSearch} className="w-56" />}
          <Button size="sm" onClick={() => { setEditId(null); setForm({ ...empty }); }}><Plus size={14} /> Ajouter</Button>
        </div>
      </div>
      <DataTable columns={cols} data={data} isLoading={isLoading} error={errorMessage} rowKey={(r) => r.id} page={list.page} onPageChange={list.setPage} dense />
      {deleteTarget && (
        <Modal title={`Supprimer — ${title}`} size="sm" onClose={() => setDeleteTarget(null)} footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Annuler</Button><Button variant="danger" loading={crud.remove.isPending} onClick={() => crud.remove.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}>Supprimer</Button></>}>
          <p className="text-sm text-ge7-black/80">Confirmer la suppression de <span className="font-semibold">{String((deleteTarget as any).name ?? deleteTarget.id)}</span> ?</p>
        </Modal>
      )}
      {form && (
        <Modal title={editId ? `Modifier — ${title}` : `Ajouter — ${title}`} size="sm" onClose={() => setForm(null)} footer={<><Button variant="secondary" onClick={() => setForm(null)}>Annuler</Button><Button type="submit" form={`crud-${queryKey}`} loading={crud.create.isPending || crud.update.isPending}>Enregistrer</Button></>}>
          <form id={`crud-${queryKey}`} onSubmit={submit}>
            <FormGrid cols={2}>
              {fields.filter((f) => !(editId && f.hideOnEdit)).map((f) => {
                const val = form[f.name] as unknown;
                const cls = f.span === 2 ? "sm:col-span-2" : "";
                if (f.type === "select")
                  return (
                    <Select key={f.name} label={f.label} required={f.required} value={String(val ?? "")} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} error={errors[f.name]} className={cls}>
                      {!f.required && <option value="">—</option>}
                      {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  );
                if (f.type === "checkbox")
                  return (
                    <label key={f.name} className={`flex items-center gap-2 pt-6 text-sm font-semibold ${cls}`}>
                      <input type="checkbox" checked={!!val} onChange={(e) => setForm({ ...form, [f.name]: e.target.checked })} className="size-4 accent-ge7-gold" /> {f.label}
                    </label>
                  );
                return (
                  <Input key={f.name} label={f.label} type={f.type ?? "text"} step={f.step} required={f.required} hint={f.hint} value={(val as string | number | undefined) ?? ""} onChange={(e) => setForm({ ...form, [f.name]: f.type === "number" ? Number(e.target.value) : e.target.value })} error={errors[f.name]} className={cls} />
                );
              })}
            </FormGrid>
          </form>
        </Modal>
      )}
    </div>
  );
}
