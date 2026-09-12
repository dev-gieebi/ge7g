import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, Plus, Printer } from "lucide-react";
import type { Invoice, PaymentMethod } from "@/types";
import { useAction, useOne } from "@/lib/hooks";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { datetime, money } from "@/lib/format";
import { Button, Card, CardHeader, ErrorState, FormGrid, Input, Loading, Modal, PageHeader, Select, StatusBadge } from "@/components/ui";
import { PrintableDocument } from "./PrintableDocument";

export function InvoiceDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const invoice = useOne<Invoice>("invoice", id ? `/invoices/${id}` : null);
  const [pay, setPay] = useState<{ amount: number; method: PaymentMethod; reference: string } | null>(null);
  const addPayment = useAction<NonNullable<typeof pay>>(() => `/invoices/${id}/payments`, { keys: ["invoice", "invoices", "dashboard"], success: "Paiement enregistré", body: (v) => v });

  const downloadPdf = async () => {
    const res = await api.get(`/invoices/${id}/pdf`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${invoice.data?.number ?? "facture"}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (invoice.isLoading) return <Loading />;
  if (!invoice.data) return <ErrorState message="Facture introuvable" />;
  const inv = invoice.data;
  const remaining = inv.total - inv.paid_amount;
  const canPay = hasRole(user, "AG_LOGISTIQUE", "DIRECTION") && remaining > 0 && inv.status !== "ANNULEE";

  return (
    <>
      <div className="no-print">
        <PageHeader
          breadcrumb={<Link to="/factures" className="inline-flex items-center gap-1 hover:underline"><ArrowLeft size={12} /> Factures</Link>}
          title={inv.number}
          subtitle={<span className="flex items-center gap-2"><StatusBadge status={inv.status} />{remaining > 0 && <span className="text-sm text-ge7-black/60">Reste à payer : <strong>{money(remaining)}</strong></span>}</span>}
          action={
            <>
              {canPay && <Button variant="purple" onClick={() => setPay({ amount: remaining, method: "ESPECES", reference: "" })}><Plus size={15} /> Paiement</Button>}
              <Button variant="secondary" onClick={() => void downloadPdf()}><Download size={15} /> PDF</Button>
              <Button onClick={() => window.print()}><Printer size={15} /> Imprimer</Button>
            </>
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <PrintableDocument
          doc={{
            kind: inv.type === "AVOIR" ? "AVOIR" : inv.type === "TICKET" ? "TICKET" : "FACTURE",
            number: inv.number,
            date: inv.date,
            customer: inv.client?.company_name,
            chantier: inv.chantier?.name,
            lines: (inv.items ?? []).map((it) => ({ label: it.description || it.product?.name || "", detail: it.product?.reference, quantity: it.quantity, unit: it.product?.unit?.symbol, unit_price: it.unit_price, total: it.total })),
            subtotal: inv.subtotal,
            tax_type: inv.tax_type,
            tax_rate: inv.tax_rate,
            tax_amount: inv.tax_amount,
            total: inv.total,
            paid_amount: inv.paid_amount,
            status: inv.status.replace(/_/g, " "),
          }}
        />
        <Card className="no-print self-start">
          <CardHeader title="Paiements" />
          {!inv.payments?.length ? (
            <p className="text-sm text-ge7-black/50">Aucun paiement.</p>
          ) : (
            <ul className="divide-y divide-ge7-black/5 text-sm">
              {inv.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2">
                  <div><p className="font-semibold">{money(p.amount)}</p><p className="text-xs text-ge7-black/50">{p.method.replace("_", " ")}{p.reference ? ` · ${p.reference}` : ""}</p></div>
                  <span className="text-xs text-ge7-black/60">{datetime(p.paid_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {pay && (
        <Modal title="Enregistrer un paiement" size="sm" onClose={() => setPay(null)} footer={<><Button variant="secondary" onClick={() => setPay(null)}>Annuler</Button><Button variant="purple" loading={addPayment.isPending} onClick={() => addPayment.mutateAsync(pay).then(() => setPay(null)).catch(() => {})}>Enregistrer</Button></>}>
          <FormGrid cols={1}>
            <Input label="Montant" type="number" min={0} max={remaining} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: Number(e.target.value) })} />
            <Select label="Mode" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value as PaymentMethod })}>
              {["ESPECES", "CARTE", "VIREMENT", "MOBILE_MONEY", "AUTRE"].map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
            </Select>
            <Input label="Référence" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} />
          </FormGrid>
        </Modal>
      )}
    </>
  );
}
