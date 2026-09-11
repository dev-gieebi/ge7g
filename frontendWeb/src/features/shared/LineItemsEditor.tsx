import { Plus, Trash2 } from "lucide-react";
import type { Product } from "@/types";
import { money, qty } from "@/lib/format";
import { Button, Input, Select } from "@/components/ui";

export interface LineItem {
  product_id?: number;
  quantity: number;
  unit_price: number;
}

export function LineItemsEditor({
  items,
  onChange,
  products,
  priceLabel = "Prix unitaire",
  defaultPrice,
  showStock,
}: {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  products: Product[];
  priceLabel?: string;
  defaultPrice?: (p: Product) => number;
  showStock?: boolean;
}) {
  const update = (i: number, patch: Partial<LineItem>) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const total = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);

  return (
    <div className="space-y-3">
      <div className="hidden grid-cols-[1fr_120px_150px_120px_40px] gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-ge7-black/50 sm:grid">
        <span>Produit</span>
        <span>Quantité</span>
        <span>{priceLabel}</span>
        <span className="text-right">Total</span>
        <span />
      </div>
      {items.map((it, i) => {
        const p = products.find((x) => x.id === it.product_id);
        return (
          <div key={i} className="grid gap-2 rounded-2xl border border-ge7-black/5 bg-ge7-cream p-2 sm:grid-cols-[1fr_120px_150px_120px_40px] sm:items-center sm:border-0 sm:bg-transparent sm:p-0">
            <Select
              required
              value={String(it.product_id ?? "")}
              onChange={(e) => {
                const prod = products.find((x) => x.id === Number(e.target.value));
                update(i, { product_id: prod?.id, unit_price: prod && defaultPrice ? defaultPrice(prod) : it.unit_price });
              }}
            >
              <option value="" disabled hidden />
              {products.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.type || x.name}{showStock ? ` · dispo ${qty(x.available_quantity, x.unit?.symbol)}` : ""}
                </option>
              ))}
            </Select>
            <Input type="number" min={0} step="any" value={it.quantity} onChange={(e) => update(i, { quantity: Number(e.target.value) })} placeholder="Qté" />
            <Input type="number" min={0} value={it.unit_price} onChange={(e) => update(i, { unit_price: Number(e.target.value) })} />
            <span className="text-right text-sm font-bold">{money(it.quantity * it.unit_price)}{p?.unit ? <span className="block text-[10px] font-normal text-ge7-black/50">/ {p.unit.symbol}</span> : null}</span>
            <button type="button" onClick={() => remove(i)} className="justify-self-end rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={15} /></button>
          </div>
        );
      })}
      <div className="flex items-center justify-between">
        <Button size="sm" variant="secondary" onClick={() => onChange([...items, { product_id: undefined, quantity: 1, unit_price: 0 }])}>
          <Plus size={14} /> Ajouter une ligne
        </Button>
        <p className="text-sm">Total : <span className="font-extrabold">{money(total)}</span></p>
      </div>
    </div>
  );
}
