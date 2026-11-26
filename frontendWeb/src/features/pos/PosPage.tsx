import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { lireBrouillon, useBrouillonAuto } from "@/lib/brouillons";
import { BrouillonsBandeau } from "@/features/shared/BrouillonsBandeau";
import { MapPin, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { getList, toApiError } from "@/lib/api";
import type { PaymentMethod, PosProduct, PosSale } from "@/types";
import { useTaxes, useZones } from "@/features/shared/refData";
import { useAction } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import { money, qty } from "@/lib/format";
import { ImageOuInitiales, initiales } from "@/components/ui/ImageOuInitiales";
import { Badge, Button, Card, ErrorState, Input, Loading, NumberField, PageHeader, SearchInput, Select } from "@/components/ui";

interface Line { product: PosProduct; quantity: number; delivered: number; unit_price: number }
interface Payload {
  items: { product_id: number; quantity: number; delivered_quantity: number; unit_price: number }[];
  tax_ids: number[];
  payment_method: PaymentMethod;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  discount_rate: number | null;
  amount_received: number | null;
  zone_id: number;
}

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "ESPECES", label: "Espèces" },
  { value: "CARTE", label: "Carte" },
  { value: "CHEQUE", label: "Chèque" },
  { value: "VIREMENT", label: "Virement" },
  { value: "MOBILE_MONEY", label: "Mobile Money" },
  { value: "AUTRE", label: "Autre" },
];

/** Saisie de la caisse conservée dans un brouillon. */
interface DonneesVente {
  cart: Line[];
  taxIds: number[];
  method: PaymentMethod;
  customer: string;
  customerPhone: string;
  customerAddress: string;
  received: number | "";
  zoneId: number | "";
  partial: boolean;
}

/** `?brouillon=…` : reprend un brouillon (la page repart de zéro à chaque brouillon choisi). */
export function PosPage() {
  const [params] = useSearchParams();
  const brouillonId = params.get("brouillon");
  return <PosPageContenu key={brouillonId ?? "nouvelle"} brouillonId={brouillonId} />;
}

function PosPageContenu({ brouillonId }: { brouillonId: string | null }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [repris] = useState(() => (user ? lireBrouillon<DonneesVente>(user.id, brouillonId)?.donnees : undefined));
  // La caissière vend au comptoir sans fiche client ; les autres rôles doivent la renseigner.
  const isCashier = user?.role === "CAISSIER";
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState<PosProduct[] | null>(null);
  const [cart, setCart] = useState<Line[]>(repris?.cart ?? []);
  const [taxIds, setTaxIds] = useState<number[]>(repris?.taxIds ?? []);
  const [method, setMethod] = useState<PaymentMethod>(repris?.method ?? "ESPECES");
  const [customer, setCustomer] = useState(repris?.customer ?? "");
  const [customerPhone, setCustomerPhone] = useState(repris?.customerPhone ?? "");
  const [customerAddress, setCustomerAddress] = useState(repris?.customerAddress ?? "");
  const [received, setReceived] = useState<number | "">(repris?.received ?? "");
  const [zoneId, setZoneId] = useState<number | "">(repris?.zoneId ?? "");
  const [partial, setPartial] = useState(repris?.partial ?? false);

  const { data: taxes } = useTaxes();
  const { data: zones } = useZones();
  const products = useQuery({
    queryKey: ["pos-products", search, zoneId],
    queryFn: () => getList<PosProduct>("/pos/products", { search: search || undefined, per_page: 200, zone_id: zoneId }),
    enabled: zoneId !== "",
  });

  const zone = zones?.find((z) => z.id === zoneId);

  useEffect(() => {
    if (taxes?.length && taxIds.length === 0) {
      setTaxIds(taxes.filter((t) => t.is_default).map((t) => t.id));
    }
  }, [taxes]);

  // Changer de ville change les prix : le panier est reparti à zéro
  // (pas à l'ouverture : un brouillon repris garde son panier).
  const zoneAffichee = useRef(zoneId);
  useEffect(() => {
    if (zoneAffichee.current === zoneId) return;
    zoneAffichee.current = zoneId;
    setCart([]);
    setFamily(null);
  }, [zoneId]);

  const selectedTaxes = useMemo(() => taxes?.filter((t) => taxIds.includes(t.id)) ?? [], [taxes, taxIds]);
  const vatCssIds = useMemo(() => taxes?.filter((t) => t.type === "TVA" || t.type === "CSS").map((t) => t.id) ?? [], [taxes]);
  const tpsIds = useMemo(() => taxes?.filter((t) => t.type === "TPS").map((t) => t.id) ?? [], [taxes]);
  const otherTaxes = useMemo(() => taxes?.filter((t) => !["TVA", "CSS", "TPS"].includes(t.type)) ?? [], [taxes]);

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
  // Plus de remise saisie à la caisse : les taxes portent sur le total HT.
  const netSubtotal = subtotal;
  const rate = selectedTaxes.reduce((s, t) => s + (t.type === "AUCUNE" ? 0 : (t.type === "TPS" ? -Number(t.rate) : Number(t.rate))), 0) / 100;
  const taxAmount = Math.round(netSubtotal * rate);
  const total = netSubtotal + taxAmount;
  const change = received !== "" && method === "ESPECES" ? Number(received) - total : null;

  // Brouillon automatique tant que la vente n'est pas encaissée.
  const brouillon = useBrouillonAuto<DonneesVente>("vente", brouillonId, {
    vide: cart.length === 0 && !customer.trim(),
    titre: customer.trim() || "Sans client",
    ville: zone?.name ?? null,
    lignes: cart.length,
    total,
    donnees: { cart, taxIds, method, customer, customerPhone, customerAddress, received, zoneId, partial },
  });

  const add = (p: PosProduct) => {
    if (p.available_quantity <= 0) return;
    setCart((c) => {
      const ex = c.find((l) => l.product.id === p.id);
      // La quantité commandée peut dépasser le stock : le reste sera livré plus tard.
      if (ex) return c.map((l) => (l.product.id === p.id ? { ...l, quantity: l.quantity + 1, delivered: Math.min(l.quantity + 1, p.available_quantity) } : l));
      return [...c, { product: p, quantity: 1, delivered: Math.min(1, p.available_quantity), unit_price: Number(p.sale_price) }];
    });
    setFamily(null);
  };
  // Quantité jamais sous 1 : seule la corbeille retire la ligne du panier.
  const setQty = (id: number, q: number) => setCart((c) => c.map((l) => (l.product.id === id ? { ...l, quantity: Math.max(1, q), delivered: Math.min(Math.max(1, q), l.product.available_quantity) } : l)));
  const removeLine = (id: number) => setCart((c) => c.filter((l) => l.product.id !== id));
  const setDelivered = (id: number, d: number) => setCart((c) => c.map((l) => (l.product.id === id ? { ...l, delivered: Math.max(0, Math.min(d, l.quantity, l.product.available_quantity)) } : l)));
  // Prix majorable uniquement : jamais en dessous du barème de la ville choisie.
  const setPrice = (id: number, p: number) => setCart((c) => c.map((l) => (l.product.id === id ? { ...l, unit_price: Math.max(l.product.sale_price, p) } : l)));

  const pay = useAction<Payload, PosSale>(() => "/pos/sales", { keys: ["pos-products", "pos-sales", "products", "stock-movements", "dashboard"], success: "Vente enregistrée", body: (v) => v });

  const checkout = () => {
    if (zoneId === "") return;
    pay
      .mutateAsync({ items: cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity, delivered_quantity: partial ? Math.min(l.delivered, l.quantity, l.product.available_quantity) : l.quantity, unit_price: l.unit_price })), tax_ids: taxIds, payment_method: isCashier ? method : "AUTRE", customer_name: customer || null, customer_phone: customerPhone || null, customer_address: customerAddress || null, discount_rate: null, amount_received: received === "" ? null : Number(received), zone_id: zoneId })
      .then((s) => { brouillon.terminer(); setCart([]); setReceived(""); setCustomer(""); setCustomerPhone(""); setCustomerAddress(""); setTaxIds([]); setPartial(false); navigate(`/admin/caisse/ventes/${s.cle ?? s.id}`); })
      .catch(() => {});
  };

  return (
    <>
      <PageHeader title="Point de vente" subtitle="Vente par ville. Prix selon le barème de la zone sélectionnée." breadcrumb="Caisse" />
      <BrouillonsBandeau type="vente" chemin="/admin/caisse" sauf={brouillon.id} />
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Select value={zoneId} onChange={(e) => setZoneId(e.target.value === "" ? "" : Number(e.target.value))} className="min-w-[220px]">
              <option value="">Choisir la ville…</option>
              {zones?.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </Select>
            <SearchInput value={search} onChange={setSearch} placeholder="Nom du produit…" className="min-w-[260px] flex-1" autoFocus />
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-3">
              {groups.map(({ key, list, single }) => {
                const p = list[0];
                const avail = list.reduce((s, x) => s + x.available_quantity, 0);
                const minPrice = Math.min(...list.map((x) => x.sale_price));
                return (
                  <button key={key} disabled={avail <= 0} onClick={() => (single ? add(p) : setFamily(list))} className="group rounded-3xl border border-ge7-black/5 bg-white p-3 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-ge7-gold disabled:opacity-50">
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

        <Card className="xl:self-start">
          <h3 className="flex items-center gap-2 text-lg font-extrabold"><ShoppingBag size={18} className="text-ge7-bronze" /> Panier ({cart.length}){zone ? <Badge tone="purple"><MapPin size={11} /> {zone.name}</Badge> : null}</h3>
          {/* Liste simple, sans défilement interne : nom, prix, quantité, total. */}
          {cart.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-ge7-black/15 p-8 text-center text-sm text-ge7-black/50">Panier vide</p>
          ) : (
            <ul className="mt-3 divide-y divide-ge7-black/5">
              {cart.map((l) => (
                <li key={l.product.id} className="py-2.5">
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold">{l.product.name}{l.product.type ? <span className="text-ge7-black/50"> · {l.product.type}</span> : null}</p>
                    <span className="shrink-0 text-sm font-bold">{money(l.unit_price * l.quantity)}</span>
                    <button onClick={() => removeLine(l.product.id)} className="shrink-0 text-ge7-black/35 hover:text-rose-600" title="Retirer du panier"><Trash2 size={15} /></button>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-xs text-ge7-black/50">
                      <NumberField min={l.product.sale_price} step="any" value={l.unit_price} valide={(p) => p >= l.product.sale_price} onValue={(p) => setPrice(l.product.id, p)} aria-label="Prix unitaire" title={`Prix unitaire (minimum ${money(l.product.sale_price)})`} className="w-24 rounded-lg border border-ge7-black/15 px-2 py-1 text-right text-sm font-semibold text-ge7-black focus:border-ge7-gold focus:outline-none" />
                      / {l.product.unit?.symbol}
                    </span>
                    <span className="flex items-center gap-1">
                      <button onClick={() => setQty(l.product.id, l.quantity - 1)} className="grid size-7 place-items-center rounded-full border border-ge7-black/15 bg-white" aria-label="Diminuer"><Minus size={14} /></button>
                      <NumberField min={0} step="any" value={l.quantity} onValue={(q) => setQty(l.product.id, q)} aria-label="Quantité" className="w-16 rounded-lg border border-ge7-black/15 px-2 py-1 text-center text-sm font-semibold focus:border-ge7-gold focus:outline-none" />
                      <button onClick={() => setQty(l.product.id, l.quantity + 1)} className="grid size-7 place-items-center rounded-full bg-ge7-gold text-ge7-black" aria-label="Augmenter"><Plus size={14} /></button>
                    </span>
                  </div>
                  {partial && (
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                      <span className="text-ge7-black/60">Livrée maintenant</span>
                      <span className="flex items-center gap-1.5">
                        <NumberField min={0} step="any" value={l.delivered} valide={(d) => d >= 0} onValue={(d) => setDelivered(l.product.id, d)} aria-label="Quantité livrée" className="w-16 rounded-lg border border-ge7-black/15 px-2 py-1 text-center text-sm font-semibold focus:border-ge7-gold focus:outline-none" />
                        <span className="text-ge7-black/50">reste {qty(l.quantity - l.delivered, l.product.unit?.symbol)}</span>
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 space-y-3 border-t border-ge7-black/5 pt-4">
            {!isCashier && (
              <>
                <Input placeholder="Nom du client *" required value={customer} onChange={(e) => setCustomer(e.target.value)} />
                {/* Téléphone et adresse côte à côte : plus de place pour les articles du panier. */}
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Téléphone du client *" required value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                  <Input placeholder="Adresse du client *" required value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
                </div>
              </>
            )}
            <div className={`grid gap-3 ${isCashier ? "grid-cols-2" : "grid-cols-1"}`}>
              {(taxes?.length ?? 0) > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ge7-black/70">Taxes</label>
                <div className="grid grid-cols-2 gap-2">
                  {vatCssIds.length > 0 && (
                    <label className="flex items-center gap-2 rounded-lg border border-ge7-black/10 px-2 py-1.5 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-ge7-black/20 text-ge7-bronze focus:ring-ge7-bronze"
                        checked={vatCssIds.every((id) => taxIds.includes(id))}
                        onChange={(e) => setTaxIds(e.target.checked ? vatCssIds : [])}
                      />
                      TVA
                    </label>
                  )}
                  {tpsIds.length > 0 && (
                    <label className="flex items-center gap-2 rounded-lg border border-ge7-black/10 px-2 py-1.5 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-ge7-black/20 text-ge7-bronze focus:ring-ge7-bronze"
                        checked={tpsIds.every((id) => taxIds.includes(id))}
                        onChange={(e) => setTaxIds(e.target.checked ? tpsIds : [])}
                      />
                      TPS
                    </label>
                  )}
                  {otherTaxes.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 rounded-lg border border-ge7-black/10 px-2 py-1.5 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-ge7-black/20 text-ge7-bronze focus:ring-ge7-bronze"
                        checked={taxIds.includes(t.id)}
                        onChange={(e) => setTaxIds((prev) => (e.target.checked ? [...prev.filter((id) => !tpsIds.includes(id)), t.id] : prev.filter((id) => id !== t.id)))}
                      />
                      {t.name}
                    </label>
                  ))}
                </div>
              </div>
              )}
              {/* Moyen de paiement : seulement pour la caissière qui encaisse. */}
              {isCashier && (
                <Select label="Paiement" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                  {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </Select>
              )}
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-ge7-black/10 px-3 py-2 text-sm" title="Seule la quantité livrée est déduite du stock ; le reste sera livré plus tard.">
              <input type="checkbox" className="size-4 rounded border-ge7-black/20 text-ge7-bronze focus:ring-ge7-bronze" checked={partial} onChange={(e) => setPartial(e.target.checked)} />
              Livraison partielle <span className="text-xs text-ge7-black/50"></span>
            </label>
            {isCashier && method === "ESPECES" && <Input label="Montant reçu *" type="number" min={0} required value={received} onChange={(e) => setReceived(e.target.value === "" ? "" : Number(e.target.value))} />}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-ge7-black/60"><span>Total HT</span><span>{money(subtotal)}</span></div>
              {/* Sans taxe : rien n'est écrit. */}
              {selectedTaxes.length > 0 && (
                <div className="flex justify-between text-ge7-black/60"><span>{`${selectedTaxes.map((t) => t.name).join(" + ")} ${(rate * 100).toFixed(2).replace(/\.?0+$/, "")} %`}</span><span>{money(taxAmount)}</span></div>
              )}
              <div className="flex justify-between text-xl font-extrabold"><span>TOTAL</span><span className="text-ge7-bronze">{money(total)}</span></div>
              {change !== null && <div className={`flex justify-between font-semibold ${change < 0 ? "text-rose-600" : "text-emerald-700"}`}><span>Monnaie à rendre</span><span>{money(Math.max(0, change))}</span></div>}
            </div>
            <Button size="lg" className="w-full" disabled={!cart.length || zoneId === "" || (!isCashier && (!customer.trim() || !customerPhone.trim() || !customerAddress.trim())) || (isCashier && method === "ESPECES" && (received === "" || (change !== null && change < 0)))} loading={pay.isPending} onClick={checkout}>Encaisser {money(total)}</Button>
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
