import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileSignature, MapPin, Minus, Plus, Trash2 } from "lucide-react";
import { ModuleTabs } from "@/components/ui";
import { DEVIS_TABS } from "@/app/moduleTabs";
import { getList, toApiError } from "@/lib/api";
import type { PosProduct, Quote } from "@/types";
import { useTaxes, useZones } from "@/features/shared/refData";
import { useAction } from "@/lib/hooks";
import { money, qty } from "@/lib/format";
import { ImageOuInitiales, initiales } from "@/components/ui/ImageOuInitiales";
import { Badge, Button, Card, ErrorState, Input, Loading, NumberField, PageHeader, SearchInput, Select, Textarea } from "@/components/ui";

interface Line { product: PosProduct; quantity: number; unit_price: number }
interface Payload {
  items: { product_id: number; quantity: number; unit_price: number }[];
  zone_id: number;
  tax_ids: number[];
  customer_name: string;
  customer_phone: string | null;
  customer_address: string | null;
  discount_rate: number | null;
  valid_until: string | null;
  notes: string | null;
  extras: { label: string; amount: number }[];
}

export function QuoteNewPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState<PosProduct[] | null>(null);
  const [cart, setCart] = useState<Line[]>([]);
  const [zoneId, setZoneId] = useState<number | "">("");
  const [taxIds, setTaxIds] = useState<number[]>([]);
  const [customer, setCustomer] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [notes, setNotes] = useState("");

  const { data: taxes } = useTaxes();
  const { data: zones } = useZones();
  const products = useQuery({
    queryKey: ["quote-products", search, zoneId],
    queryFn: () => getList<PosProduct>("/pos/products", { search: search || undefined, per_page: 200, zone_id: zoneId }),
    enabled: zoneId !== "",
  });

  const zone = zones?.find((z) => z.id === zoneId);

  useEffect(() => {
    if (taxes?.length && taxIds.length === 0) {
      setTaxIds(taxes.filter((t) => t.is_default).map((t) => t.id));
    }
  }, [taxes]);

  // Changer de ville change les prix : le panier repart à zéro.
  useEffect(() => {
    setCart([]);
    setFamily(null);
  }, [zoneId]);

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

  const subtotal = cart.reduce((s, l) => s + l.unit_price * l.quantity, 0);
  // Plus de remise saisie sur la proforma : les taxes portent sur le total HT.
  const netSubtotal = subtotal;
  const rate = selectedTaxes.reduce((s, t) => s + (t.type === "AUCUNE" ? 0 : (t.type === "TPS" ? -Number(t.rate) : Number(t.rate))), 0) / 100;
  const taxAmount = Math.round(netSubtotal * rate);
  const total = netSubtotal + taxAmount;

  const add = (p: PosProduct) => {
    setCart((c) => {
      const ex = c.find((l) => l.product.id === p.id);
      if (ex) return c.map((l) => (l.product.id === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [...c, { product: p, quantity: 1, unit_price: Number(p.sale_price) }];
    });
    setFamily(null);
  };
  // Quantité jamais sous 1 : seule la corbeille retire la ligne.
  const setQty = (id: number, q: number) => setCart((c) => c.map((l) => (l.product.id === id ? { ...l, quantity: Math.max(1, q) } : l)));
  const removeLine = (id: number) => setCart((c) => c.filter((l) => l.product.id !== id));
  // Prix majorable uniquement : jamais en dessous du barème de la ville choisie.
  const setPrice = (id: number, p: number) => setCart((c) => c.map((l) => (l.product.id === id ? { ...l, unit_price: Math.max(l.product.sale_price, p) } : l)));

  const create = useAction<Payload, Quote>(() => "/quotes", { keys: ["quotes"], success: "Proforma enregistrée", body: (v) => v });

  const submit = () => {
    create
      .mutateAsync({
        items: cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity, unit_price: l.unit_price })),
        zone_id: Number(zoneId),
        tax_ids: taxIds,
        customer_name: customer,
        customer_phone: customerPhone || null,
        customer_address: customerAddress || null,
        discount_rate: null,
        valid_until: null,
        notes: notes || null,
        extras: [],
      })
      .then((q) => navigate(`/admin/devis/${q.id}`))
      .catch(() => {});
  };

  return (
    <>
      <ModuleTabs tabs={DEVIS_TABS} />
      <PageHeader
        title="Nouvelle proforma"
        subtitle="Proposition commerciale  n'affecte ni le stock ni les ventes."
        breadcrumb={<button onClick={() => navigate("/admin/devis")} className="inline-flex items-center gap-1 hover:underline"><ArrowLeft size={12} /> Proforma</button>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Select value={zoneId} onChange={(e) => setZoneId(e.target.value === "" ? "" : Number(e.target.value))} className="min-w-[220px]">
              <option value="">Choisir la ville…</option>
              {zones?.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </Select>
            <SearchInput value={search} onChange={setSearch} placeholder="Nom ou référence du produit…" className="min-w-[260px] flex-1" autoFocus />
          </div>
          {zoneId === "" ? (
            <div className="grid place-items-center rounded-3xl border border-dashed border-ge7-black/15 bg-white/60 p-16 text-center">
              <div>
                <MapPin size={32} className="mx-auto text-ge7-bronze/50" />
                <p className="mt-3 font-semibold">Sélectionnez une ville</p>
                <p className="mt-1 text-sm text-ge7-black/50">Les produits proposés et leurs prix dépendent du barème de la ville choisie.</p>
              </div>
            </div>
          ) : products.isLoading ? (
            <Loading />
          ) : products.error ? (
            <ErrorState message={toApiError(products.error).message} onRetry={() => void products.refetch()} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map(({ key, list, single }) => {
                const p = list[0];
                const avail = list.reduce((s, x) => s + x.available_quantity, 0);
                const minPrice = Math.min(...list.map((x) => x.sale_price));
                return (
                  <button key={key} onClick={() => (single ? add(p) : setFamily(list))} className="group rounded-3xl border border-ge7-black/5 bg-white p-3 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-ge7-gold">
                    <div className="mb-3 grid h-28 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-ge7-gold-soft to-ge7-pearl">
                      <ImageOuInitiales src={p.image_url} alt={p.name} className="h-full w-full object-cover" fallback={<span className="font-display text-3xl font-extrabold text-ge7-bronze/60">{initiales(p.name)}</span>} />
                    </div>
                    <p className="font-bold leading-tight">{p.name}</p>
                    <p className="font-mono text-[11px] font-semibold text-ge7-black/40">{p.reference}</p>
                    <p className="text-xs text-ge7-black/50">{single ? (p.type ?? "") : `${list.length} types disponibles`}</p>
                    <div className="mt-2 flex items-end justify-between">
                      <span className="font-extrabold text-ge7-bronze">{single ? money(p.sale_price) : `dès ${money(minPrice)}`}</span>
                      <Badge tone={avail <= 0 ? "red" : "green"}>{qty(avail, p.unit?.symbol)}</Badge>
                    </div>
                  </button>
                );
              })}
              {groups.length === 0 && (
                <p className="col-span-full rounded-2xl border border-dashed border-ge7-black/15 p-8 text-center text-sm text-ge7-black/50">
                  Aucun produit avec un barème pour cette ville.
                </p>
              )}
            </div>
          )}
        </div>

        <Card className="xl:sticky xl:top-20 xl:self-start">
          <h3 className="flex items-center gap-2 text-lg font-extrabold"><FileSignature size={18} className="text-ge7-bronze" /> Proforma{zone ? <Badge tone="purple"><MapPin size={11} /> {zone.name}</Badge> : null}</h3>
          <div className="mt-4 max-h-[max(60vh,32rem)] space-y-2 overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-ge7-black/15 p-8 text-center text-sm text-ge7-black/50">Aucune ligne</p>
            ) : (
              cart.map((l) => (
                <div key={l.product.id} className="rounded-2xl bg-ge7-cream p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><p className="truncate font-semibold">{l.product.name}{l.product.type ? <span className="text-ge7-black/50"> · {l.product.type}</span> : null}</p></div>
                    <button onClick={() => removeLine(l.product.id)} className="text-rose-600" title="Retirer la ligne"><Trash2 size={15} /></button>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <button onClick={() => setQty(l.product.id, l.quantity - 1)} className="grid size-10 shrink-0 place-items-center rounded-lg bg-white"><Minus size={14} /></button>
                    <NumberField min={0} step="any" value={l.quantity} onValue={(q) => setQty(l.product.id, q)} aria-label="Quantité" className="min-w-0 flex-1 rounded-lg border border-ge7-black/15 bg-white px-2.5 py-2 text-center text-base font-semibold focus:border-ge7-gold focus:outline-none" />
                    <button onClick={() => setQty(l.product.id, l.quantity + 1)} className="grid size-10 shrink-0 place-items-center rounded-lg bg-white"><Plus size={14} /></button>
                    {l.product.unit?.symbol && <span className="shrink-0 text-xs text-ge7-black/50">{l.product.unit.symbol}</span>}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 border-t border-ge7-black/5 pt-2">
                    <NumberField min={l.product.sale_price} step="any" value={l.unit_price} valide={(p) => p >= l.product.sale_price} onValue={(p) => setPrice(l.product.id, p)} aria-label="Prix unitaire" title={`Prix unitaire (minimum ${money(l.product.sale_price)})`} className="w-[6.5rem] rounded-lg border border-ge7-black/15 bg-white px-2 py-1.5 text-right text-sm font-semibold focus:border-ge7-gold focus:outline-none" />
                    <span className="font-bold">{money(l.unit_price * l.quantity)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 space-y-3 border-t border-ge7-black/5 pt-4">
            <Input placeholder="Nom du client *" required value={customer} onChange={(e) => setCustomer(e.target.value)} />
            {/* Téléphone et adresse côte à côte : plus de place pour les lignes de la proforma. */}
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Téléphone du client" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              <Input placeholder="Adresse du client" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
            </div>
            {(taxes?.length ?? 0) > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ge7-black/70">Taxes</label>
              <div className="grid grid-cols-2 gap-2">
                {(taxes ?? []).map((t) => (
                  <label key={t.id} className="flex items-center gap-2 rounded-lg border border-ge7-black/10 px-2 py-1.5 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-ge7-black/20 text-ge7-bronze focus:ring-ge7-bronze"
                      checked={taxIds.includes(t.id)}
                      onChange={(e) => setTaxIds((prev) => (e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id)))}
                    />
                    {t.name}
                  </label>
                ))}
              </div>
            </div>
            )}
            <Textarea placeholder="Notes / conditions (optionnel)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-ge7-black/60"><span>Total HT</span><span>{money(subtotal)}</span></div>
              {/* Sans taxe : rien n'est écrit. */}
              {selectedTaxes.length > 0 && (
                <div className="flex justify-between text-ge7-black/60"><span>{`${selectedTaxes.map((t) => t.name).join(" + ")} ${(rate * 100).toFixed(2).replace(/\.?0+$/, "")} %`}</span><span>{money(taxAmount)}</span></div>
              )}
              <div className="flex justify-between text-xl font-extrabold"><span>TOTAL</span><span className="text-ge7-bronze">{money(total)}</span></div>
            </div>
            <Button size="lg" className="w-full" disabled={!cart.length || !customer.trim() || zoneId === ""} loading={create.isPending} onClick={submit}>Enregistrer la proforma {money(total)}</Button>
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
                <button key={p.id} onClick={() => add(p)} className="flex items-center justify-between rounded-2xl border border-ge7-black/10 p-4 text-left transition hover:border-ge7-gold hover:bg-ge7-gold-soft/40">
                  <div><p className="font-bold">{p.type}</p><p className="font-mono text-[11px] text-ge7-black/40">{p.reference}</p><p className="text-xs text-ge7-black/50">dispo {qty(p.available_quantity, p.unit?.symbol)}</p></div>
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
