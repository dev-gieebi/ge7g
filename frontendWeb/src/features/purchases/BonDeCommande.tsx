import { Mail, MapPin, Phone } from "lucide-react";
import type { Purchase } from "@/types";
import { date, money, qty } from "@/lib/format";
import { GE7_COMPANY, cfaNumber } from "@/features/shared/companyInfo";

export function BonDeCommande({ purchase }: { purchase: Purchase }) {
  const p = purchase;
  // Transforme le N° d'achat « ACH-2026-00003 » en N° de bon de commande « BC-00003-2026 ».
  const parts = p.number.split("-");
  const number = parts.length === 3 ? `BC-${parts[2]}-${parts[1]}` : p.number;

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
          BON DE COMMANDE
        </h1>

        <div className="mt-8 space-y-1">
          <p>
            <span className="font-bold underline">Date</span> : {date(p.date)}
          </p>
          <p>
            <span className="font-bold underline">N° de commande</span> : {number}
          </p>
        </div>

        <div className="mt-4 space-y-1 border border-ge7-black/70 px-2 py-2">
          <p>
            <span className="underline font-bold">Nom de la société</span> : G-ENERGIE 7 GROUPE
          </p>
          <p>
            <span className="underline font-bold">Téléphone</span> : +241 062 18 04 92
          </p>
          <p>
            <span className="underline font-bold">Adresse</span> : Ntoum-Gabon
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
            {p.items?.map((it) => (
              <tr key={it.id}>
                <td className="border border-ge7-black/70 px-1 py-1">
                  {it.product?.name}
                </td>
                <td className="border border-ge7-black/70 px-1 py-1 text-center">{it.product?.unit?.symbol ?? ""}</td>
                <td className="border border-ge7-black/70 px-1 py-1 text-center">{qty(it.quantity)}</td>
                <td className="border border-ge7-black/70 px-1 py-1 text-right">{cfaNumber.format(Number(it.unit_price))}</td>
                <td className="border border-ge7-black/70 px-1 py-1 text-right">{cfaNumber.format(Number(it.quantity) * Number(it.unit_price))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 flex justify-end">
          <div className="w-64 space-y-0.5 text-[12px]">
            <div className="flex justify-between border border-ge7-black/80 pl-1 pr-1 font-extrabold">
              <span>TOTAL</span>
              <span>{money(p.total)}</span>
            </div>
          </div>
        </div>

        <p className="mt-2">
          <span className="font-bold italic underline">Arrêté le présent bon de commande au montant de :</span>{" "}
          <strong>{money(p.total)}</strong>
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
