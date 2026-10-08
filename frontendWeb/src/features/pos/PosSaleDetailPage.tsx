import { Link, useNavigate, useParams } from "react-router-dom";
import { useCallback, useState } from "react";
import { ArrowLeft, FileText, Printer, Receipt, Truck } from "lucide-react";
import type { PosSale } from "@/types";
import { useAction, useOne } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import { qty } from "@/lib/format";
import { Badge, Button, Card, ErrorState, Loading, PageHeader, StatusBadge } from "@/components/ui";
import { PrintableDocument } from "@/features/invoices/PrintableDocument";
import { Facture } from "./Facture";

export function PosSaleDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const sale = useOne<PosSale>("pos-sale", id ? `/pos/sales/${id}` : null);
  const navigate = useNavigate();
  // Le ticket papier caisse est réservé au caissier ; l'agent voit la facture A4.
  const isCashier = user?.role === "CAISSIER";
  const mode = isCashier ? "ticket" : "invoice";
  const [deliverQty, setDeliverQty] = useState<Record<number, number>>({});
  const [discountRate, setDiscountRate] = useState<number | null>(null);

  const deliver = useAction<{ item_id: number; quantity: number }, PosSale>(
    () => `/pos/sales/${id}/deliver`,
    { keys: ["pos-sale", "pos-sales", "stock-movements", "products", "dashboard"], success: "Livraison enregistrée", body: (v) => ({ items: [{ id: v.item_id, quantity: v.quantity }] }) },
  );

  const applyDiscount = useAction<{ discount_rate: number }, PosSale>(
    () => `/pos/sales/${id}/discount`,
    { keys: ["pos-sale", "pos-sales", "dashboard"], success: "Remise appliquée", body: (v) => v },
  );

  const handlePrint = useCallback(() => {
    const onAfter = () => {
      window.removeEventListener("afterprint", onAfter);
      navigate("/caisse");
    };
    window.addEventListener("afterprint", onAfter);
    window.print();
  }, [navigate]);

  if (sale.isLoading) return <Loading />;
  if (!sale.data) return <ErrorState message="Vente introuvable" />;
  const s = sale.data;

  const doc = {
    kind: (mode === "ticket" ? "TICKET" : "FACTURE") as "TICKET" | "FACTURE",
    number: mode === "invoice" && s.invoice ? s.invoice.number : s.number,
    date: s.created_at,
    customer: s.customer_name,
    cashier: user?.name ?? s.cashier?.name,
    lines: (s.items ?? []).map((it) => ({ label: it.product?.name ?? "", detail: it.product?.type, quantity: it.quantity, unit: it.product?.unit?.symbol, unit_price: it.unit_price, total: it.total })),
    subtotal: s.subtotal,
    tax_type: s.tax_type,
    tax_rate: s.tax_rate,
    tax_amount: s.tax_amount,
    total: s.total,
    paid_amount: s.total,
    payment_method: s.payment_method,
  };

  return (
    <>
      <div className="no-print">
        <PageHeader
          breadcrumb={
            <Link to={isCashier ? "/caisse" : "/caisse/ventes"} className="inline-flex items-center gap-1 hover:underline">
              <ArrowLeft size={12} /> {isCashier ? "Caisse" : "Ventes"}
            </Link>
          }
          title={s.number}
          subtitle={<span className="inline-flex items-center gap-2"><StatusBadge status={s.status} /><StatusBadge status={s.delivery_status} />{s.zone ? <Badge tone="purple">{s.zone.name}</Badge> : null}</span>}
          action={
            <>
              <Button onClick={handlePrint}>{isCashier ? <Receipt size={15} /> : <Printer size={15} />} {isCashier ? "Ticket" : "Facture"}</Button>
              <Button onClick={handlePrint}><Printer size={15} /> Imprimer</Button>
            </>
          }
        />
      </div>
      {(s.items ?? []).length > 0 && s.delivery_status !== "LIVREE" && (
        <Card className="no-print mx-auto mb-6 max-w-2xl">
          <h3 className="flex items-center gap-2 font-extrabold"><Truck size={16} className="text-ge7-bronze" /> Livraison <StatusBadge status={s.delivery_status} /></h3>
          <div className="mt-3 space-y-2">
            {(s.items ?? []).map((it) => {
              const remaining = Number(it.remaining_quantity);
              const unit = it.product?.unit?.symbol;
              return (
                <div key={it.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-ge7-cream px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-semibold">{it.product?.name}{it.product?.type ? ` · ${it.product.type}` : ""}</span>
                  <span className="text-xs text-ge7-black/60">commandée {qty(Number(it.quantity), unit)} · livrée {qty(Number(it.delivered_quantity), unit)}{remaining > 0 ? ` · reste ${qty(remaining, unit)}` : ""}</span>
                  {remaining > 0 && (
                    <span className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={deliverQty[it.id] ?? remaining}
                        onChange={(e) => setDeliverQty((d) => ({ ...d, [it.id]: Number(e.target.value) }))}
                        className="w-20 rounded-lg border border-ge7-black/10 px-2 py-1 text-center text-sm"
                      />
                      <Button
                        size="sm"
                        loading={deliver.isPending}
                        onClick={() =>
                          deliver
                            .mutateAsync({ item_id: it.id, quantity: Math.min(Math.max(deliverQty[it.id] ?? remaining, 0), remaining) })
                            .then(() => setDeliverQty((d) => { const n = { ...d }; delete n[it.id]; return n; }))
                            .catch(() => {})
                        }
                      >
                        Livrer
                      </Button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
      {!isCashier && (
        <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-end gap-2 text-sm">
          <label className="font-semibold">Remise %</label>
          <input
            type="number"
            min={0}
            max={100}
            step="any"
            value={discountRate ?? Number(s.discount_rate ?? 0)}
            onChange={(e) => setDiscountRate(e.target.value === "" ? 0 : Number(e.target.value))}
            className="w-24 rounded-lg border border-ge7-black/10 px-2 py-1.5 text-center"
          />
          <Button
            size="sm"
            variant="purple"
            loading={applyDiscount.isPending}
            onClick={() => applyDiscount.mutateAsync({ discount_rate: discountRate ?? Number(s.discount_rate ?? 0) }).then(() => setDiscountRate(null)).catch(() => {})}
          >
            Appliquer
          </Button>
        </div>
      )}
      {isCashier ? (
        <PrintableDocument compact doc={doc} />
      ) : (
        <Facture sale={s} />
      )}
      <div className="no-print mt-6 text-center"><Link to="/caisse"><Button variant="purple">Nouvelle vente</Button></Link></div>
    </>
  );
}
