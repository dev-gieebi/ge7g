import { useEffect, useMemo, useState } from "react";
import { ModuleTabs } from "@/components/ui";
import { CAISSE_TABS } from "@/app/moduleTabs";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { getList, toApiError } from "@/lib/api";
import type { PaymentMethod, PosProduct, PosSale } from "@/types";
import { useTaxes } from "@/features/shared/refData";
import { useAction } from "@/lib/hooks";
import { money, qty } from "@/lib/format";
import { Badge, Button, Card, ErrorState, Input, Loading, PageHeader, SearchInput, Select } from "@/components/ui";

interface Line { product: PosProduct; quantity: number }
interface Payload {
  items: { product_id: number; quantity: number }[];
  tax_ids: number[];
  payment_method: PaymentMethod;
  customer_name: string | null;
  amount_received: number | null;
}

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "ESPECES", label: "Espèces" },
  { value: "CARTE", label: "Carte" },
  { value: "VIREMENT", label: "Virement" },
  { value: "MOBILE_MONEY", label: "Mobile Money" },
  { value: "AUTRE", label: "Autre" },
];

export function PosPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState<PosProduct[] | null>(null);
  const [cart, setCart] = useState<Line[]>([]);
  const [taxIds, setTaxIds] = useState<number[]>([]);
  const [method, setMethod] = useState<PaymentMethod>("ESPECES");
  const [customer, setCustomer] = useState("");
  const [received, setReceived] = useState<number | "">("");

  const { data: taxes } = useTaxes();
  const products = useQuery({
    queryKey: ["pos-products", search],
    queryFn: () => getList<PosProduct>("/pos/products", { search: search || undefined, per_page: 200 }),
  });

  useEffect(() => {
    if (taxes?.length && taxIds.length === 0) {
      setTaxIds(taxes.filter((t) => t.is_default).map((t) => t.id));
    }
  }, [taxes]);

  const selectedTaxes = useMemo(() => taxes?.filter((t) => taxIds.includes(t.id)) ?? [], [taxes, taxIds]);

  const groups = useMemo(() => {
    const items = products.data?.data ?? [];
    const byName = new Map<string, PosProduct[]>();
    items.forEach((p) => {
      const key = p.type ? p.name : `${p.id}`;
      (byName.get(key) ?? byName.set(key, []).get(key)!).push(p);
    });
    return Array.from(byName.entries()).map(([key, list]) => ({ key, list, single: list.length === 1 }));
  }, [products.data]);

  const subtotal = cart.reduce((s, l) => s + l.product.sale_price * l.quantity, 0);
  const rate = selectedTaxes.reduce((s, t) => s + (t.type === "AUCUNE" ? 0 : Number(t.rate)), 0) / 100;
  const taxAmount = Math.round(subtotal * rate);
  const total = subtotal + taxAmount;
  const change = received !== "" && method === "ESPECES" ? Number(received) - total : null;

  const add = (p: PosProduct) => {
    if (p.available_quantity <= 0) return;
    setCart((c) => {
      const ex = c.find((l) => l.product.id === p.id);
      if (ex) return c.map((l) => (l.product.id === p.id ? { ...l, quantity: Math.min(l.quantity + 1, p.available_quantity) } : l));
      return [...c, { product: p, quantity: 1 }];
    });
    setFamily(null);
  };
  const setQty = (id: number, q: number) => setCart((c) => c.map((l) => (l.product.id === id ? { ...l, quantity: Math.max(0, Math.min(q, l.product.available_quantity)) } : l)).filter((l) => l.quantity > 0));

  const pay = useAction<Payload, PosSale>(() => "/pos/sales", { keys: ["pos-products", "pos-sales", "products", "stock-movements", "dashboard"], success: "Vente enregistrée", body: (v) => v });

  const checkout = () =>
    pay
      .mutateAsync({ items: cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity })), tax_ids: taxIds, payment_method: method, customer_name: customer || null, amount_received: received === "" ? null : Number(received) })
      .then((s) => { setCart([]); setReceived(""); setCustomer(""); setTaxIds([]); navigate(`/caisse/ventes/${s.id}`); })
      .catch(() => {});

  return (
    <>
      <ModuleTabs tabs={CAISSE_TABS} />
      <PageHeader title="Point de vente" subtitle="Vente directe au comptoir. Prix de vente uniquement." breadcrumb="Caisse" />
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Produit, référence, code-barres…" className="min-w-[260px] flex-1" autoFocus />
          </div>

          {products.isLoading ? (
            <Loading />
          ) : products.error ? (
            <ErrorState message={toApiError(products.error).message} onRetry={() => void products.refetch()} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {groups.map(({ key, list, single }) => {
                const p = list[0];
                const avail = list.reduce((s, x) => s + x.available_quantity, 0);
                const minPrice = Math.min(...list.map((x) => x.sale_price));
                return (
                  <button key={key} disabled={avail <= 0} onClick={() => (single ? add(p) : setFamily(list))} className="group rounded-3xl border border-ge7-black/5 bg-white p-3 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-ge7-gold disabled:opacity-50">
                    <div className="mb-3 grid h-28 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-ge7-gold-soft to-ge7-pearl">
                      {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" /> : <span className="font-display text-3xl font-extrabold text-ge7-bronze/60">{p.name.slice(0, 2).toUpperCase()}</span>}
                    </div>
                    <p className="font-bold leading-tight">{p.name}</p>
                    <p className="text-xs text-ge7-black/50">{single ? `${p.reference}${p.type ? ` · ${p.type}` : ""}` : `${list.length} types disponibles`}</p>
                    <div className="mt-2 flex items-end justify-between">
                      <span className="font-extrabold text-ge7-bronze">{single ? money(p.sale_price) : `dès ${money(minPrice)}`}</span>
                      <Badge tone={avail <= 0 ? "red" : "green"}>{qty(avail, p.unit?.symbol)}</Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <Card className="xl:sticky xl:top-20 xl:self-start">
          <h3 className="flex items-center gap-2 text-lg font-extrabold"><ShoppingBag size={18} className="text-ge7-bronze" /> Panier</h3>
          <div className="mt-4 max-h-[38vh] space-y-2 overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-ge7-black/15 p-8 text-center text-sm text-ge7-black/50">Panier vide</p>
            ) : (
              cart.map((l) => (
                <div key={l.product.id} className="rounded-2xl bg-ge7-cream p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><p className="truncate font-semibold">{l.product.name}{l.product.type ? <span className="text-ge7-black/50"> · {l.product.type}</span> : null}</p><p className="text-xs text-ge7-black/50">{money(l.product.sale_price)} / {l.product.unit?.symbol}</p></div>
                    <button onClick={() => setQty(l.product.id, 0)} className="text-rose-600"><Trash2 size={15} /></button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setQty(l.product.id, l.quantity - 1)} className="grid size-8 place-items-center rounded-lg bg-white"><Minus size={14} /></button>
                      <input type="number" min={0} step="any" value={l.quantity} onChange={(e) => setQty(l.product.id, Number(e.target.value))} className="w-16 rounded-lg border border-ge7-black/10 px-2 py-1 text-center text-sm" />
                      <button onClick={() => setQty(l.product.id, l.quantity + 1)} className="grid size-8 place-items-center rounded-lg bg-white"><Plus size={14} /></button>
                    </div>
                    <span className="font-bold">{money(l.product.sale_price * l.quantity)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 space-y-3 border-t border-ge7-black/5 pt-4">
            <Input placeholder="Nom client (optionnel)" value={customer} onChange={(e) => setCustomer(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ge7-black/70">Taxes</label>
                <div className="grid grid-cols-2 gap-2">
                  {taxes?.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 rounded-lg border border-ge7-black/10 px-2 py-1.5 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-ge7-black/20 text-ge7-bronze focus:ring-ge7-bronze"
                        checked={taxIds.includes(t.id)}
                        onChange={(e) =>
                          setTaxIds((prev) => (e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id)))
                        }
                      />
                      {t.name}
                    </label>
                  ))}
                </div>
              </div>
              <Select label="Paiement" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </Select>
            </div>
            {method === "ESPECES" && <Input label="Montant reçu" type="number" min={0} value={received} onChange={(e) => setReceived(e.target.value === "" ? "" : Number(e.target.value))} />}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-ge7-black/60"><span>Sous-total HT</span><span>{money(subtotal)}</span></div>
              <div className="flex justify-between text-ge7-black/60"><span>{selectedTaxes.length === 0 ? "Taxe" : `${selectedTaxes.map((t) => t.name).join(" + ")} ${(rate * 100).toFixed(2).replace(/\.?0+$/, "")} %`}</span><span>{money(taxAmount)}</span></div>
              <div className="flex justify-between text-xl font-extrabold"><span>TOTAL</span><span className="text-ge7-bronze">{money(total)}</span></div>
              {change !== null && <div className={`flex justify-between font-semibold ${change < 0 ? "text-rose-600" : "text-emerald-700"}`}><span>Monnaie à rendre</span><span>{money(Math.max(0, change))}</span></div>}
            </div>
            <p className="text-[11px] text-ge7-black/40">Montants indicatifs — le calcul définitif est effectué par le serveur.</p>
            <Button size="lg" className="w-full" disabled={!cart.length || (method === "ESPECES" && change !== null && change < 0)} loading={pay.isPending} onClick={checkout}>Encaisser {money(total)}</Button>
          </div>
        </Card>
      </div>

      {family && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ge7-black/70 p-4" onMouseDown={(e) => e.target === e.currentTarget && setFamily(null)}>
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-soft">
            <h3 className="text-lg font-extrabold">{family[0].name}</h3>
            <p className="text-sm text-ge7-black/60">Choisissez le type</p>
            <div className="mt-4 grid gap-2">
              {family.map((p) => (
                <button key={p.id} disabled={p.available_quantity <= 0} onClick={() => add(p)} className="flex items-center justify-between rounded-2xl border border-ge7-black/10 p-4 text-left transition hover:border-ge7-gold hover:bg-ge7-gold-soft/40 disabled:opacity-50">
                  <div><p className="font-bold">{p.type}</p><p className="text-xs text-ge7-black/50">{p.reference} · dispo {qty(p.available_quantity, p.unit?.symbol)}</p></div>
                  <span className="font-extrabold text-ge7-bronze">{money(p.sale_price)}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end"><Button variant="secondary" onClick={() => setFamily(null)}>Annuler</Button></div>
          </div>
        </div>
      )}
    </>
  );
}
