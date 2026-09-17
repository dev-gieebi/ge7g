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

export function PrintableDocument({ doc, compact, dense }: { doc: DocData; compact?: boolean; dense?: boolean }) {
  const ratePct = (Number(doc.tax_rate) * 100).toFixed(2).replace(/\.?0+$/, "");
  const container = compact
    ? "max-w-sm rounded-3xl p-6 font-mono text-sm"
    : dense
      ? "max-w-xl rounded-2xl p-4 text-[11px]"
      : "max-w-3xl rounded-3xl p-8 sm:p-10";
  return (
    <div className={`mx-auto bg-white text-ge7-black ${container} shadow-soft print:max-w-none print:shadow-none`}>
      <div className={`flex ${compact ? "flex-col items-center text-center" : "items-start justify-between"} ${dense ? "gap-2" : "gap-4"}`}>
        <Logo size={compact ? 44 : dense ? 36 : 56} />
        <div className={compact ? "" : "text-right"}>
          <p className={`${dense ? "text-[10px]" : "text-xs"} font-bold uppercase tracking-[0.25em] text-ge7-bronze`}>{doc.kind === "TICKET" ? "Ticket de caisse" : doc.kind === "AVOIR" ? "Avoir" : "Facture"}</p>
          <p className={`font-display font-extrabold ${dense ? "text-sm" : "text-xl"}`}>{doc.number}</p>
          <p className={`${dense ? "text-[10px]" : "text-xs"} text-ge7-black/60`}>{datetime(doc.date)}</p>
        </div>
      </div>

      {!compact && (
        <div className={`${dense ? "mt-3 gap-3" : "mt-8 gap-6"} grid sm:grid-cols-2`}>
          <div>
            <p className={`${dense ? "text-[10px]" : "text-xs"} font-bold uppercase tracking-wider text-ge7-black/50`}>Émetteur</p>
            <p className="mt-1 font-bold">G-Energy 7 Group</p>
            {doc.cashier && <p className={`${dense ? "text-[10px]" : "text-sm"} text-ge7-black/70`}>Caissier : {doc.cashier}</p>}
          </div>
          <div className="sm:text-right">
            <p className={`${dense ? "text-[10px]" : "text-xs"} font-bold uppercase tracking-wider text-ge7-black/50`}>Client</p>
            {doc.customer && <p className="mt-1 font-bold">{doc.customer}</p>}
            {doc.chantier && <p className={`${dense ? "text-[10px]" : "text-sm"} text-ge7-black/70`}>Chantier : {doc.chantier}</p>}
          </div>
        </div>
      )}
      {compact && (doc.customer || doc.cashier) && (
        <div className="mt-4 border-y border-dashed border-ge7-black/20 py-2 text-xs">
          {doc.customer && <p>Client : {doc.customer}</p>}
          {doc.cashier && <p>Caissier : {doc.cashier}</p>}
        </div>
      )}

      <table className={`${dense ? "mt-2" : "mt-6"} w-full ${dense ? "text-[11px]" : "text-sm"}`}>
        <thead>
          <tr className={compact ? "border-b border-dashed border-ge7-black/20 text-left text-xs" : `bg-ge7-black text-left uppercase tracking-wider text-ge7-gold-light ${dense ? "text-[9px]" : "text-xs"}`}>
            <th className={compact ? "py-1" : dense ? "rounded-l-lg px-2 py-1" : "rounded-l-xl px-3 py-2"}>Désignation</th>
            <th className={`text-right ${compact ? "py-1" : dense ? "px-2 py-1" : "px-3 py-2"}`}>Qté</th>
            <th className={`text-right ${compact ? "py-1" : dense ? "px-2 py-1" : "px-3 py-2"}`}>PU</th>
            <th className={`text-right ${compact ? "py-1" : dense ? "rounded-r-lg px-2 py-1" : "rounded-r-xl px-3 py-2"}`}>Total</th>
          </tr>
        </thead>
        <tbody className={compact ? "" : "divide-y divide-ge7-black/5"}>
          {doc.lines.map((l, i) => (
            <tr key={i}>
              <td className={compact ? "py-1" : dense ? "px-2 py-1" : "px-3 py-2"}><p className="font-semibold">{l.label}</p>{l.detail && <p className={`${dense ? "text-[10px]" : "text-xs"} text-ge7-black/50`}>{l.detail}</p>}</td>
              <td className={`text-right ${compact ? "py-1" : dense ? "px-2 py-1" : "px-3 py-2"}`}>{qty(l.quantity, l.unit)}</td>
              <td className={`text-right ${compact ? "py-1" : dense ? "px-2 py-1" : "px-3 py-2"}`}>{money(l.unit_price)}</td>
              <td className={`text-right font-semibold ${compact ? "py-1" : dense ? "px-2 py-1" : "px-3 py-2"}`}>{money(l.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={`${dense ? "mt-2" : "mt-4"} ${compact ? "border-t border-dashed border-ge7-black/20 pt-2" : "flex justify-end"}`}>
        <div className={compact ? "space-y-0.5 text-sm" : dense ? "w-56 space-y-0.5 text-[11px]" : "w-72 space-y-1 text-sm"}>
          <div className="flex justify-between"><span className="text-ge7-black/60">Sous-total HT</span><span>{money(doc.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-ge7-black/60">{doc.tax_type === "AUCUNE" ? "Taxe : aucune" : `${doc.tax_type} ${ratePct} %`}</span><span>{money(doc.tax_amount)}</span></div>
          <div className={`flex justify-between border-t border-ge7-black/10 pt-1 font-extrabold ${dense ? "text-sm" : "text-lg"}`}><span>TOTAL</span><span className="text-ge7-bronze">{money(doc.total)}</span></div>
          {doc.paid_amount !== undefined && <div className={`flex justify-between text-ge7-black/60 ${dense ? "text-[10px]" : "text-xs"}`}><span>Payé</span><span>{money(doc.paid_amount)}</span></div>}
          {doc.payment_method && <div className={`flex justify-between text-ge7-black/60 ${dense ? "text-[10px]" : "text-xs"}`}><span>Mode</span><span>{doc.payment_method.replace("_", " ")}</span></div>}
        </div>
      </div>

      <p className={`${dense ? "mt-3 text-[10px]" : "mt-6 text-xs"} text-center text-ge7-black/50 ${compact ? "" : `border-t border-ge7-black/5 ${dense ? "pt-2" : "pt-4"}`}`}>
        Merci de votre confiance · G-Energy 7 Group{doc.status ? ` · ${doc.status}` : ""}
      </p>
    </div>
  );
}
