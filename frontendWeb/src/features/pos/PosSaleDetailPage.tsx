import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Printer, Receipt } from "lucide-react";
import { useState } from "react";
import type { PosSale } from "@/types";
import { useOne } from "@/lib/hooks";
import { Badge, Button, ErrorState, Loading, PageHeader, StatusBadge } from "@/components/ui";
import { PrintableDocument } from "@/features/invoices/PrintableDocument";

export function PosSaleDetailPage() {
  const { id } = useParams();
  const sale = useOne<PosSale>("pos-sale", id ? `/pos/sales/${id}` : null);
  const [mode, setMode] = useState<"ticket" | "invoice">("ticket");

  if (sale.isLoading) return <Loading />;
  if (!sale.data) return <ErrorState message="Vente introuvable" />;
  const s = sale.data;

  return (
    <>
      <div className="no-print">
        <PageHeader
          breadcrumb={<Link to="/caisse/ventes" className="inline-flex items-center gap-1 hover:underline"><ArrowLeft size={12} /> Ventes</Link>}
          title={s.number}
          subtitle={<span className="inline-flex items-center gap-2"><StatusBadge status={s.status} />{s.zone ? <Badge tone="purple">{s.zone.name}</Badge> : null}</span>}
          action={
            <>
              <Button variant={mode === "ticket" ? "dark" : "secondary"} onClick={() => setMode("ticket")}><Receipt size={15} /> Ticket</Button>
              <Button variant={mode === "invoice" ? "dark" : "secondary"} onClick={() => setMode("invoice")}><FileText size={15} /> Facture</Button>
              <Button onClick={() => window.print()}><Printer size={15} /> Imprimer</Button>
            </>
          }
        />
      </div>
      <PrintableDocument
        compact={mode === "ticket"}
        doc={{
          kind: mode === "ticket" ? "TICKET" : "FACTURE",
          number: mode === "invoice" && s.invoice ? s.invoice.number : s.number,
          date: s.created_at,
          customer: s.customer_name,
          cashier: s.cashier?.name,
          lines: (s.items ?? []).map((it) => ({ label: it.product?.name ?? "", detail: it.product?.type ?? it.product?.reference, quantity: it.quantity, unit: it.product?.unit?.symbol, unit_price: it.unit_price, total: it.total })),
          subtotal: s.subtotal,
          tax_type: s.tax_type,
          tax_rate: s.tax_rate,
          tax_amount: s.tax_amount,
          total: s.total,
          paid_amount: s.total,
          payment_method: s.payment_method,
        }}
      />
      <div className="no-print mt-6 text-center"><Link to="/caisse"><Button variant="purple">Nouvelle vente</Button></Link></div>
    </>
  );
}
