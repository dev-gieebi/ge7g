import { Logo } from "@/components/ui";
import { datetime, money, qty } from "@/lib/format";
import type { PaymentMethod, TaxType } from "@/types";

export interface DocLine {
  label: string;
  detail?: string | null;
  quantity: number;
  unit?: string;
  unit_price: number;
  total: number;
}

export interface DocData {
  kind: "TICKET" | "FACTURE" | "AVOIR";
  number: string;
  date: string;
  customer?: string | null;
  chantier?: string | null;
  cashier?: string | null;
  lines: DocLine[];
  subtotal: number;
  tax_type: TaxType;
  tax_rate: number;
  tax_amount: number;
  total: number;
  paid_amount?: number;
  payment_method?: PaymentMethod | null;
  status?: string;
}

export function PrintableDocument({ doc, compact }: { doc: DocData; compact?: boolean }) {
  const ratePct = (Number(doc.tax_rate) * 100).toFixed(2).replace(/\.?0+$/, "");
  return (
    <div className={`mx-auto bg-white text-ge7-black ${compact ? "max-w-sm rounded-3xl p-6 font-mono text-sm" : "max-w-3xl rounded-3xl p-8 sm:p-10"} shadow-soft print:max-w-none print:shadow-none`}>
      <div className={`flex ${compact ? "flex-col items-center text-center" : "items-start justify-between"} gap-4`}>
        <Logo size={compact ? 44 : 56} />
        <div className={compact ? "" : "text-right"}>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-ge7-bronze">{doc.kind === "TICKET" ? "Ticket de caisse" : doc.kind === "AVOIR" ? "Avoir" : "Facture"}</p>
          <p className="font-display text-xl font-extrabold">{doc.number}</p>
          <p className="text-xs text-ge7-black/60">{datetime(doc.date)}</p>
        </div>
      </div>

      {!compact && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-ge7-black/50">Émetteur</p>
            <p className="mt-1 font-bold">G-Energy 7 Group</p>
            <p className="text-sm text-ge7-black/70">Matériaux, énergie & équipements de chantier</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-bold uppercase tracking-wider text-ge7-black/50">Client</p>
            <p className="mt-1 font-bold">{doc.customer ?? "Client comptoir"}</p>
            {doc.chantier && <p className="text-sm text-ge7-black/70">Chantier : {doc.chantier}</p>}
          </div>
        </div>
      )}
      {compact && (doc.customer || doc.cashier) && (
        <div className="mt-4 border-y border-dashed border-ge7-black/20 py-2 text-xs">
          {doc.customer && <p>Client : {doc.customer}</p>}
          {doc.cashier && <p>Caissier : {doc.cashier}</p>}
        </div>
      )}

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className={compact ? "border-b border-dashed border-ge7-black/20 text-left text-xs" : "bg-ge7-black text-left text-xs uppercase tracking-wider text-ge7-gold-light"}>
            <th className={compact ? "py-1" : "rounded-l-xl px-3 py-2"}>Désignation</th>
            <th className={`text-right ${compact ? "py-1" : "px-3 py-2"}`}>Qté</th>
            <th className={`text-right ${compact ? "py-1" : "px-3 py-2"}`}>PU</th>
            <th className={`text-right ${compact ? "py-1" : "rounded-r-xl px-3 py-2"}`}>Total</th>
          </tr>
        </thead>
        <tbody className={compact ? "" : "divide-y divide-ge7-black/5"}>
          {doc.lines.map((l, i) => (
            <tr key={i}>
              <td className={compact ? "py-1" : "px-3 py-2"}><p className="font-semibold">{l.label}</p>{l.detail && <p className="text-xs text-ge7-black/50">{l.detail}</p>}</td>
              <td className={`text-right ${compact ? "py-1" : "px-3 py-2"}`}>{qty(l.quantity, l.unit)}</td>
              <td className={`text-right ${compact ? "py-1" : "px-3 py-2"}`}>{money(l.unit_price)}</td>
              <td className={`text-right font-semibold ${compact ? "py-1" : "px-3 py-2"}`}>{money(l.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={`mt-4 ${compact ? "border-t border-dashed border-ge7-black/20 pt-2" : "flex justify-end"}`}>
        <div className={compact ? "space-y-0.5 text-sm" : "w-72 space-y-1 text-sm"}>
          <div className="flex justify-between"><span className="text-ge7-black/60">Sous-total HT</span><span>{money(doc.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-ge7-black/60">{doc.tax_type === "AUCUNE" ? "Taxe : aucune" : `${doc.tax_type} ${ratePct} %`}</span><span>{money(doc.tax_amount)}</span></div>
          <div className="flex justify-between border-t border-ge7-black/10 pt-1 text-lg font-extrabold"><span>TOTAL</span><span className="text-ge7-bronze">{money(doc.total)}</span></div>
          {doc.paid_amount !== undefined && <div className="flex justify-between text-xs text-ge7-black/60"><span>Payé</span><span>{money(doc.paid_amount)}</span></div>}
          {doc.payment_method && <div className="flex justify-between text-xs text-ge7-black/60"><span>Mode</span><span>{doc.payment_method.replace("_", " ")}</span></div>}
        </div>
      </div>

      <p className={`mt-6 text-center text-xs text-ge7-black/50 ${compact ? "" : "border-t border-ge7-black/5 pt-4"}`}>
        Merci de votre confiance · G-Energy 7 Group{doc.status ? ` · ${doc.status}` : ""}
      </p>
    </div>
  );
}
