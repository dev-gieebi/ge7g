import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useRef } from "react";
import { ArrowLeft, FileText, Printer, Receipt, Scissors } from "lucide-react";
import type { PosSale } from "@/types";
import { useOne } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import { Badge, Button, ErrorState, Loading, PageHeader, StatusBadge } from "@/components/ui";
import { PrintableDocument } from "@/features/invoices/PrintableDocument";

export function PosSaleDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const sale = useOne<PosSale>("pos-sale", id ? `/pos/sales/${id}` : null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const autoPrinted = useRef(false);
  // Le ticket papier caisse est réservé au caissier ; l'agent voit la facture A4.
  const isCashier = user?.role === "CAISSIER";
  const mode = isCashier ? "ticket" : "invoice";

  const handlePrint = useCallback(() => {
    const onAfter = () => {
      window.removeEventListener("afterprint", onAfter);
      navigate("/caisse");
    };
    window.addEventListener("afterprint", onAfter);
    window.print();
  }, [navigate]);

  // Arrivée depuis « Encaisser » : impression directe, puis retour au point de vente.
  useEffect(() => {
    if (searchParams.get("print") !== "1" || !sale.data || autoPrinted.current) return;
    autoPrinted.current = true;
    const t = setTimeout(handlePrint, 400);
    return () => clearTimeout(t);
  }, [searchParams, sale.data, handlePrint]);

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
          subtitle={<span className="inline-flex items-center gap-2"><StatusBadge status={s.status} />{s.zone ? <Badge tone="purple">{s.zone.name}</Badge> : null}</span>}
          action={
            <>
              <Button variant="dark">{isCashier ? <Receipt size={15} /> : <FileText size={15} />} {isCashier ? "Ticket" : "Facture"}</Button>
              <Button onClick={handlePrint}><Printer size={15} /> Imprimer</Button>
            </>
          }
        />
      </div>
      {isCashier ? (
        <PrintableDocument compact doc={doc} />
      ) : (
        <div>
          <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-ge7-black/40">Copie client</p>
          <div className="print:break-inside-avoid"><PrintableDocument dense doc={doc} /></div>
          <div className="mx-auto my-3 flex max-w-2xl items-center gap-3 text-ge7-black/40" aria-hidden>
            <span className="h-px flex-1 border-t-2 border-dashed border-ge7-black/40" />
            <Scissors size={16} />
            <span className="h-px flex-1 border-t-2 border-dashed border-ge7-black/40" />
          </div>
          <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-ge7-black/40">Copie vendeur</p>
          <div className="print:break-inside-avoid"><PrintableDocument dense doc={doc} /></div>
        </div>
      )}
      <div className="no-print mt-6 text-center"><Link to="/caisse"><Button variant="purple">Nouvelle vente</Button></Link></div>
    </>
  );
}
