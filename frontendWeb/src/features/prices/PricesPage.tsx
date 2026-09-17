import { useState, type FormEvent } from "react";
import { ModuleTabs } from "@/components/ui";
import { CATALOGUE_TABS } from "@/app/moduleTabs";
import { Download, Plus } from "lucide-react";
import type { Price, Product, Zone } from "@/types";
import { fieldErrors, useCrud, useListState, usePaginated } from "@/lib/hooks";
import { useProductsRef, useZones } from "@/features/shared/refData";
import { money } from "@/lib/format";
import { getList } from "@/lib/api";
import * as XLSX from "xlsx-js-style";
import { Badge, Button, DataTable, FormGrid, Input, Modal, PageHeader, Select, type Column } from "@/components/ui";

type Form = Partial<Omit<Price, "id" | "product" | "zone">>;

export function PricesPage() {
  const list = useListState({ per_page: 20 });
  const { data, isLoading, errorMessage } = usePaginated<Price>("prices", "/prices", list.params);
  const crud = useCrud<Price, Form>("prices", "/prices");
  const { data: products } = useProductsRef();
  const { data: zones } = useZones();
  const [editing, setEditing] = useState<Form | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const openNew = () => {
    setEditingId(null);
    setEditing({ product_id: products?.[0]?.id, zone_id: null, competitor_price: 0, amount: 0, factory_price: 0, for_pos: false });
  };
  const openEdit = (price: Price) => {
    setEditingId(price.id);
    setEditing({
      product_id: price.product_id,
      zone_id: price.zone_id,
      competitor_price: price.competitor_price,
      amount: price.amount,
      factory_price: price.factory_price,
      for_pos: price.for_pos ?? false,
    });
  };
  const close = () => {
    setEditing(null);
    setEditingId(null);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (editingId) {
      crud.update.mutateAsync({ id: editingId, body: editing }).then(close).catch(() => {});
    } else {
      crud.create.mutateAsync(editing).then(close).catch(() => {});
    }
  };
  const errors = fieldErrors(editingId ? crud.update.error : crud.create.error);
  const [isExporting, setIsExporting] = useState(false);

  const exportToExcel = async () => {
    setIsExporting(true);
    try {
      const all = await getList<Price>("/prices", { ...list.params, page: 1, per_page: 500 });
      const zones = [...new Set(all.data.map((p) => p.zone?.name ?? "Toutes les zones"))];

      const zoneBg: Record<string, string> = {
        "FCV ET MOANDA": "FFC00000",
        "FCVET MOANDA": "FFC00000",
        "OTEM": "FF0070C0",
        "LBV": "FF00B050",
      };

      const common = {
        border: {
          top: { style: "thin", color: { rgb: "FF000000" } },
          bottom: { style: "thin", color: { rgb: "FF000000" } },
          left: { style: "thin", color: { rgb: "FF000000" } },
          right: { style: "thin", color: { rgb: "FF000000" } },
        },
      };

      const header = {
        concurrent: { fill: { fgColor: { rgb: "FFFFFF00" } }, font: { bold: true }, alignment: { horizontal: "center", vertical: "center" } },
        g7g: { fill: { fgColor: { rgb: "FF8E44AD" } }, font: { bold: true, color: { rgb: "FFFFFFFF" } }, alignment: { horizontal: "center", vertical: "center" } },
        usine: { fill: { fgColor: { rgb: "FF92D050" } }, font: { bold: true }, alignment: { horizontal: "center", vertical: "center" } },
        design: { fill: { fgColor: { rgb: "FFFFFFFF" } }, font: { bold: true }, alignment: { horizontal: "center", vertical: "center" } },
      };

      const dataStyle = {
        concurrent: { fill: { fgColor: { rgb: "FFFFFF99" } }, alignment: { horizontal: "right" } },
        g7g: { fill: { fgColor: { rgb: "FFF2E5F7" } }, alignment: { horizontal: "right" } },
        usine: { fill: { fgColor: { rgb: "FFE2EFDA" } }, alignment: { horizontal: "right" } },
        design: { fill: { fgColor: { rgb: "FFFFFFFF" } }, alignment: { horizontal: "left" } },
      };

      const cell = (v: string | number, style: object, type?: string) => ({
        v,
        t: type ?? (typeof v === "number" ? "n" : "s"),
        s: { ...common, ...style },
      });

      const rows: object[][] = [];

      for (const zoneName of zones) {
        const zBg = zoneBg[zoneName] ?? "FFB0B0B0";
        const zoneHeader = { fill: { fgColor: { rgb: zBg } }, font: { bold: true, color: { rgb: "FFFFFFFF" } }, alignment: { horizontal: "left", vertical: "center" } };

        rows.push([
          cell(zoneName, zoneHeader),
          cell("PRIX VENTE CONCURRENT", header.concurrent),
          cell("PRIX VENTE G-E7G", header.g7g),
          cell("USINE", header.usine),
        ]);
        rows.push([
          cell("DÉSIGNATION", header.design),
          cell("UNITE", header.concurrent),
          cell("UNITE", header.g7g),
          cell("PU HT", header.usine),
        ]);
        all.data
          .filter((p) => (p.zone?.name ?? "Toutes les zones") === zoneName)
          .forEach((p) => {
            rows.push([
              cell(p.product?.name ?? "", dataStyle.design),
              cell(Number(p.competitor_price) || 0, dataStyle.concurrent),
              cell(Number(p.amount) || 0, dataStyle.g7g),
              cell(Number(p.factory_price) || 0, dataStyle.usine),
            ]);
          });
        rows.push([cell("", {}), cell("", {}), cell("", {}), cell("", {})]);
      }

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 30 }, { wch: 24 }, { wch: 24 }, { wch: 16 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Prix et barème");
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `prix-barème-${date}.xlsx`);
    } finally {
      setIsExporting(false);
    }
  };

  const columns: Column<Price>[] = [
    { key: "product", header: "Produit", render: (p) => <span className="font-semibold">{p.product?.name}</span> },
    { key: "zone", header: "Zone", render: (p) => p.zone?.name ?? <Badge>Toutes</Badge> },
    { key: "competitor_price", header: "Prix concurrent", align: "right", render: (p) => money(p.competitor_price) },
    { key: "amount", header: "Prix vente G-E7G", align: "right", sortable: true, render: (p) => <span className="font-bold text-ge7-purple">{money(p.amount)}</span> },
    { key: "factory_price", header: "PU Usine HT", align: "right", render: (p) => money(p.factory_price) },
    { key: "for_pos", header: "Caisse", align: "center", render: (p) => p.for_pos ? <Badge tone="green">Oui</Badge> : <span className="text-ge7-black/30">—</span> },
  ];

  return (
    <>
      <ModuleTabs tabs={CATALOGUE_TABS} />
      <PageHeader
        title="Prix"
        subtitle="Barème par produit et zone : prix concurrent, prix de vente G-E7G et prix usine HT."
        breadcrumb="Produits"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={exportToExcel} loading={isExporting}>
              <Download size={16} /> Exporter
            </Button>
            <Button onClick={openNew}>
              <Plus size={16} /> Nouveau prix
            </Button>
          </div>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Select value={String(list.filters.product_id ?? "")} onChange={(e) => list.setFilter("product_id", e.target.value)} className="sm:col-span-2">
          <option value="">Tous les produits</option>
          {products?.map((p: Product) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Select value={String(list.filters.zone_id ?? "")} onChange={(e) => list.setFilter("zone_id", e.target.value)}>
          <option value="">Toutes les zones</option>
          {zones?.map((z: Zone) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </Select>
        <Select value={String(list.filters.for_pos ?? "")} onChange={(e) => list.setFilter("for_pos", e.target.value)}>
          <option value="">Tous les prix</option>
          <option value="1">Caisse</option>
          <option value="0">Barème</option>
        </Select>
      </div>
      <DataTable columns={columns} data={data} isLoading={isLoading} error={errorMessage} rowKey={(p) => p.id} onRowClick={openEdit} page={list.page} onPageChange={list.setPage} sort={list.sort} onSortChange={list.setSort} emptyTitle="Aucun prix défini" emptyHint="Le prix de vente par défaut du produit s'applique." />

      {editing && (
        <Modal
          title={editingId ? "Modifier le prix" : "Nouveau prix"}
          subtitle="Prix concurrent, prix de vente G-E7G et prix usine HT pour la zone choisie."
          onClose={close}
          footer={
            <>
              <Button variant="secondary" onClick={close}>Annuler</Button>
              <Button type="submit" form="price-form" loading={editingId ? crud.update.isPending : crud.create.isPending}>
                {editingId ? "Enregistrer" : "Créer"}
              </Button>
            </>
          }
        >
          <form id="price-form" onSubmit={submit}>
            <FormGrid>
              <Select label="Produit" required value={String(editing.product_id ?? "")} onChange={(e) => setEditing({ ...editing, product_id: e.target.value ? Number(e.target.value) : undefined })} error={errors.product_id} className="sm:col-span-2">
                {products?.map((p: Product) => <option key={p.id} value={p.id}>{p.name} ({p.reference})</option>)}
              </Select>
              <Select label="Zone" hint="Avec une ville, le prix s'applique au point de vente de cette ville." value={String(editing.zone_id ?? "")} onChange={(e) => setEditing({ ...editing, zone_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Toutes</option>
                {zones?.map((z: Zone) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </Select>
              <Input label="Prix concurrent (FCFA)" type="number" min={0} required value={editing.competitor_price ?? 0} onChange={(e) => setEditing({ ...editing, competitor_price: Number(e.target.value) })} error={errors.competitor_price} />
              <Input label="Prix vente G-E7G (FCFA)" type="number" min={0} required value={editing.amount ?? 0} onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })} error={errors.amount} />
              <Input label="PU Usine HT (FCFA)" type="number" min={0} required value={editing.factory_price ?? 0} onChange={(e) => setEditing({ ...editing, factory_price: Number(e.target.value) })} error={errors.factory_price} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!editing.for_pos} onChange={(e) => setEditing({ ...editing, for_pos: e.target.checked })} className="size-4 rounded border-ge7-black/20 text-ge7-bronze focus:ring-ge7-bronze" />
                Prix destiné à la caisse (comptoir uniquement)
              </label>
            </FormGrid>
          </form>
        </Modal>
      )}
    </>
  );
}
