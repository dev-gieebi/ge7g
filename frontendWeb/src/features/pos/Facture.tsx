import { Mail, MapPin, Phone } from "lucide-react";
import type { PosSale } from "@/types";
import { datetime, money, qty } from "@/lib/format";
import { GE7_COMPANY, cfaNumber } from "@/features/shared/companyInfo";

export function Facture({ sale }: { sale: PosSale }) {
  const s = sale;
  // Transforme le N° de vente « VNT-2026-00012 » en N° de facture « FAC-00012-2026 ».
  const parts = s.number.split("-");
  const number = s.invoice?.number ?? (parts.length === 3 ? `FAC-${parts[2]}-${parts[1]}` : s.number);
  const ratePct = (Number(s.tax_rate) * 100).toFixed(2).replace(/\.?0+$/, "");
  const discountRate = Number(s.discount_rate ?? 0);
  const discountAmount = Math.round(Number(s.subtotal) * discountRate / 100);
  const netSubtotal = Number(s.subtotal) - discountAmount;
  const fmtRate = (r: number) => r.toFixed(2).replace(/\.?0+$/, "");
  const taxRows =
    s.tax_details && s.tax_details.length > 0
      ? s.tax_details
          .filter((t) => t.type !== "AUCUNE" && Number(t.amount) !== 0)
          .map((t) => ({ label: `${t.type} ${fmtRate(Number(t.rate))} %`, amount: Number(t.amount) }))
      : s.tax_type === "AUCUNE" || Number(s.tax_amount) === 0
        ? []
        : [{ label: `${s.tax_type} ${ratePct} %`, amount: Number(s.tax_amount) }];

  return (
    <div className="font-times mx-auto max-w-3xl bg-white px-4 py-2 text-[13px] leading-relaxed text-ge7-black shadow-soft print:max-w-none print:shadow-none">

      <div className="flex items-stretch border-b-2 border-ge7-black/60 bg-white print:fixed print:inset-x-0 print:top-0">
        <div className="flex w-52 flex-col items-center justify-center border-r border-ge7-black/60 py-2 pr-4">
          <img src="/logo-ge7g.png" alt="G-E7G" className="h-26 w-26 object-contain" />
        </div>
        <div className="flex-1 py-2 pl-4 text-[16px] font-semibold leading-snug">
          {GE7_COMPANY.activities.map((a) => (
            <p key={a}>{a}</p>
          ))}
        </div>
      </div>
      <div className="px-6 print:pt-36">
        <h1 className="mt-6 text-center text-4xl font-bold tracking-wide text-[#065baf] underline underline-offset-4">
          FACTURE
        </h1>

        <div className="mt-8 space-y-1">
          <p>
            <span className="font-bold underline">Date</span> : {datetime(s.created_at)}
          </p>
          <p>
            <span className="font-bold underline">N° de facture</span> : {number}
          </p>
        </div>

        <div className="mt-4 space-y-1 border border-ge7-black/70 px-2 py-2">
          <p>
            <span className="underline font-bold">Nom du client</span> : {s.customer_name ?? ""}
          </p>
          <p>
            <span className="underline font-bold">Téléphone</span> : {s.customer_phone ?? ""}
          </p>
          <p>
            <span className="underline font-bold">Adresse</span> : {s.customer_address ?? ""}
          </p>
        </div>

        <table className="mt-4 w-full border-collapse">
          <thead>
            <tr className="font-bold">
              <th className="border border-ge7-black/70 px-2 py-2 text-left">DESIGNATIONS</th>
              <th className="border border-ge7-black/70 px-2 py-2">Unités</th>
              <th className="border border-ge7-black/70 px-2 py-2">Quantités</th>
              <th className="border border-ge7-black/70 px-2 py-2">P.U(CFA)</th>
              <th className="border border-ge7-black/70 px-2 py-2">Total (CFA)</th>
            </tr>
          </thead>
          <tbody>
            {(s.items ?? []).map((it) => (
              <tr key={it.id}>
                <td className="border border-ge7-black/70 px-1 py-1">
                  {it.product?.name}
                  {it.product?.type ? ` (${it.product.type})` : ""}
                </td>
                <td className="border border-ge7-black/70 px-1 py-1 text-center">{it.product?.unit?.symbol ?? ""}</td>
                <td className="border border-ge7-black/70 px-1 py-1 text-center">{qty(it.quantity)}</td>
                <td className="border border-ge7-black/70 px-1 py-1 text-right">{cfaNumber.format(Number(it.unit_price))}</td>
                <td className="border border-ge7-black/70 px-1 py-1 text-right">{cfaNumber.format(Number(it.total))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 flex justify-end">
          <div className="w-64 space-y-0.5 text-[12px]">
            <div className="border border-ge7-black/80 p-1">
              <div className="flex justify-between">
                <span className="text-[#065baf]/70 font-bold">{discountAmount > 0 ? "Sous-total HT" : taxRows.length > 0 ? "TOTAL HT" : "Sous-total HT"}</span>
                <span className="font-bold">{money(s.subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-[#065baf]/70 font-bold">REMISE {fmtRate(discountRate)} %</span>
                    <span className="font-bold">-{money(discountAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#065baf]/70 font-bold">TOTAL HT</span>
                    <span className="font-bold">{money(netSubtotal)}</span>
                  </div>
                </>
              )}
              {taxRows.map((t, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-[#065baf]/70 font-bold">{t.label}</span>
                  <span className="font-bold">{money(t.amount)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between border border-ge7-black/80 pl-1 pr-1 font-extrabold">
              <span>TOTAL TTC</span>
              <span className="font-bold">{money(s.total)}</span>
            </div>
          </div>
        </div>

        <p className="mt-2">
          <span className="font-bold italic underline">Arrêtée la présente facture au montant de :</span>{" "}
          <strong>{money(s.total)}</strong>
        </p>

        <div className="mt-6 text-center">
          <p className="font-semibold underline">{GE7_COMPANY.signatoryTitle}</p>
          <p className="mt-20 font-semibold underline">{GE7_COMPANY.signatoryName}</p>
        </div>
      </div>
      <footer className="mt-70 border-t border-ge7-black/60 bg-white pt-2 text-center text-[10px] print:fixed print:inset-x-0 print:bottom-0">
        <p className="flex flex-wrap items-center justify-center gap-x-4">
          <span className="text-[#065baf] font-bold inline-flex items-center gap-1">
            <Phone size={10} /> {GE7_COMPANY.phones}
          </span>
          <span className="text-[#065baf] font-bold inline-flex items-center gap-1">
            <Mail size={10} /> {GE7_COMPANY.email}
          </span>
          <span className="text-[#065baf] font-bold inline-flex items-center gap-1">
            <MapPin size={10} /> {GE7_COMPANY.address}
          </span>
        </p>
        <p className="text-[#065baf] mt-0.5 font-bold">{GE7_COMPANY.bank}</p>
        <p className="text-[#065baf] font-bold">Site Web : {GE7_COMPANY.website}</p>
      </footer>
    </div>
  );
}
