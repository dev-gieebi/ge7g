import { useState, type FormEvent } from "react";
import { ModuleTabs } from "@/components/ui";
import { APPRO_TABS } from "@/app/moduleTabs";
import { PackageCheck, Plus } from "lucide-react";
import type { Purchase, PurchaseItem } from "@/types";
import { fieldErrors, useAction, useCrud, useListState, useOne, usePaginated } from "@/lib/hooks";
import { useProductsRef, useSuppliersRef } from "@/features/shared/refData";
import { LineItemsEditor, type LineItem } from "@/features/shared/LineItemsEditor";
import { date, money, qty } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { Button, DataTable, FormGrid, Input, Modal, PageHeader, SearchInput, Select, StatusBadge, type Column } from "@/components/ui";

interface PurchaseForm {
  supplier_id?: number;
  date: string;
  reference?: string;
  items: LineItem[];
}

export function PurchasesPage() {
  const list = useListState({ per_page: 15 });
  const { data, isLoading, errorMessage } = usePaginated<Purchase>("purchases", "/purchases", list.params);
  const crud = useCrud<Purchase, PurchaseForm>("purchases", "/purchases");
  const { data: suppliers } = useSuppliersRef();
  const { data: products } = useProductsRef();
  const [form, setForm] = useState<PurchaseForm | null>(null);
  const [receiveId, setReceiveId] = useState<number | null>(null);
  const detail = useOne<Purchase>("purchase", receiveId ? `/purchases/${receiveId}` : null);
  const [received, setReceived] = useState<Record<number, number>>({});
  const notify = useToast();

  const receive = useAction<{ id: number; items: { item_id: number; quantity: number }[] }>((v) => `/purchases/${v.id}/receive`, {
    keys: ["purchases", "purchase", "products", "stock-movements", "dashboard"],
    success: "Réception enregistrée — stock mis à jour",
    body: (v) => ({ items: v.items }),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!form.supplier_id) {
      notify("Veuillez sélectionner un fournisseur", "error");
      return;
    }
    if (form.items.length === 0 || form.items.some((it) => !it.product_id || it.quantity <= 0)) {
      notify("Veuillez sélectionner un produit et une quantité valide pour chaque ligne", "error");
      return;
    }
    crud.create.mutateAsync(form).then(() => setForm(null)).catch(() => {});
  };
  const errors = fieldErrors(crud.create.error);

  const openReceive = (p: Purchase) => {
    setReceiveId(p.id);
    setReceived({});
  };
  const submitReceive = () => {
    if (!receiveId || !detail.data?.items) return;
    const items = detail.data.items
      .map((it) => ({ item_id: it.id, quantity: received[it.id] ?? Math.max(0, it.quantity - it.received_quantity) }))
      .filter((x) => x.quantity > 0);
    receive.mutateAsync({ id: receiveId, items }).then(() => setReceiveId(null)).catch(() => {});
  };

  const columns: Column<Purchase>[] = [
    { key: "number", header: "N°", sortable: true, render: (p) => <span className="font-semibold">{p.number}</span> },
    { key: "supplier", header: "Fournisseur", render: (p) => p.supplier?.name },
    { key: "date", header: "Date", sortable: true, render: (p) => date(p.date) },
    { key: "total", header: "Montant", align: "right", render: (p) => <span className="font-semibold">{money(p.total)}</span> },
    { key: "status", header: "Statut", render: (p) => <StatusBadge status={p.status} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (p) =>
        p.status === "COMMANDE" || p.status === "RECU_PARTIEL" ? (
          <Button size="sm" variant="purple" onClick={() => openReceive(p)}><PackageCheck size={14} /> Réceptionner</Button>
        ) : null,
    },
  ];

  return (
    <>
      <ModuleTabs tabs={APPRO_TABS} />
      <PageHeader title="Achats" subtitle="Bons d'achat fournisseurs et réceptions. Une réception augmente le stock central." breadcrumb="Approvisionnement" action={<Button onClick={() => setForm({ supplier_id: undefined, date: new Date().toISOString().slice(0, 10), items: [{ product_id: undefined, quantity: 1, unit_price: 0 }] })}><Plus size={16} /> Nouveau bon d'achat</Button>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="N°, fournisseur…" />
        <Select value={String(list.filters.supplier_id ?? "")} onChange={(e) => list.setFilter("supplier_id", e.target.value)}>
          <option value="">Tous les fournisseurs</option>
          {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Select value={String(list.filters.status ?? "")} onChange={(e) => list.setFilter("status", e.target.value)}>
          <option value="">Tous les statuts</option>
          {["COMMANDE", "RECU_PARTIEL", "RECU", "ANNULE"].map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>
      <DataTable columns={columns} data={data} isLoading={isLoading} error={errorMessage} rowKey={(p) => p.id} page={list.page} onPageChange={list.setPage} sort={list.sort} onSortChange={list.setSort} emptyTitle="Aucun achat" />

      {form && (
        <Modal title="Nouveau bon d'achat" size="lg" onClose={() => setForm(null)} footer={<><Button variant="secondary" onClick={() => setForm(null)}>Annuler</Button><Button type="submit" form="pur-form" loading={crud.create.isPending} disabled={!form.supplier_id || form.items.length === 0 || form.items.some((it) => !it.product_id || it.quantity <= 0)}>Créer le bon</Button></>}>
          <form id="pur-form" onSubmit={submit} className="space-y-5">
            <FormGrid cols={2}>
              <Select label="Fournisseur" required value={String(form.supplier_id ?? "")} onChange={(e) => setForm({ ...form, supplier_id: Number(e.target.value) })} error={errors.supplier_id}>
                <option value="" disabled hidden />
                {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <Input label="Date" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} error={errors.date} />
            </FormGrid>
            <LineItemsEditor items={form.items} onChange={(items) => setForm({ ...form, items })} products={products ?? []} priceLabel="Prix d'achat" defaultPrice={(p) => p.purchase_price ?? 0} />
            {errors.items && <p className="text-xs text-rose-600">{errors.items[0]}</p>}
          </form>
        </Modal>
      )}

      {receiveId && (
        <Modal title={`Réception ${detail.data?.number ?? ""}`} subtitle="Saisissez les quantités réellement reçues. Le stock est incrémenté et un mouvement ENTREE est créé par ligne." onClose={() => setReceiveId(null)} footer={<><Button variant="secondary" onClick={() => setReceiveId(null)}>Annuler</Button><Button variant="purple" onClick={submitReceive} loading={receive.isPending}>Valider la réception</Button></>}>
          {detail.data?.items ? (
            <div className="space-y-2">
              {detail.data.items.map((it: PurchaseItem) => {
                const remaining = it.quantity - it.received_quantity;
                return (
                  <div key={it.id} className="grid items-center gap-3 rounded-2xl bg-ge7-cream p-3 sm:grid-cols-[1fr_auto_140px]">
                    <div>
                      <p className="font-semibold">{it.product?.name}</p>
                      <p className="text-xs text-ge7-black/50">Commandé {qty(it.quantity, it.product?.unit?.symbol)} · déjà reçu {qty(it.received_quantity)}</p>
                    </div>
                    <span className="text-xs text-ge7-black/60">Reste {qty(remaining)}</span>
                    <Input type="number" min={0} max={remaining} step="any" value={received[it.id] ?? remaining} onChange={(e) => setReceived({ ...received, [it.id]: Number(e.target.value) })} />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-ge7-black/50">Chargement…</p>
          )}
        </Modal>
      )}
    </>
  );
}
