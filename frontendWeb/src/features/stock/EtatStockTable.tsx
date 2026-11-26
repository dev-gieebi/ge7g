import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet } from "lucide-react";
import { api, toApiError } from "@/lib/api";
import type { EtatStockLigne, PilotageReport } from "@/types";
import { money, qty } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { Badge, Button, Card, CardHeader, ErrorState, Loading } from "@/components/ui";

function AlerteCell({ alerte }: { alerte: EtatStockLigne["alerte"] }) {
  if (alerte === "OK") {
    return <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">OK</span>;
  }
  return (
    <Badge tone={alerte === "STOCK NÉGATIF" ? "red" : "amber"}>
      {alerte === "STOCK NÉGATIF" ? "STOCK NÉGATIF" : "À RÉAPPROVISIONNER"}
    </Badge>
  );
}

const HEADERS = [
  "Code article", "Désignation", "Unité", "Entrées cumulées",
  "Sorties (vendues)", "Stock réel", "Stock minimum",
  "Alerte", "Prix de vente (FCFA)",
] as const;

/** Valeur du stock : Direction et Super admin uniquement. */
const VALEUR = "Valeur stock estimée (FCFA)";

const cell = "border border-ge7-black/15 px-2 py-1.5";
const num = `${cell} text-right whitespace-nowrap`;

/**
 * État du stock par article : cumul de toutes les entrées et sorties
 * (calculé depuis les mouvements). Direction, Super admin et approvisionneur ;
 * la valeur du stock n'est affichée qu'à la Direction et au Super admin.
 */
export function EtatStockTable() {
  const [exporting, setExporting] = useState(false);
  const { user } = useAuth();
  const voitValeur = hasRole(user, "DG_ADMIN");
  const colonnes = voitValeur ? [...HEADERS, VALEUR] : [...HEADERS];

  const pilotage = useQuery({
    queryKey: ["report-pilotage"],
    queryFn: async () => (await api.get<{ data: PilotageReport }>("/reports/pilotage")).data.data,
  });

  const exportXlsx = async () => {
    setExporting(true);
    try {
      const { data } = await api.get<Blob>("/reports/pilotage/export", { responseType: "blob" });
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `etat-stock-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const lignes = pilotage.data?.etat_stock ?? [];

  if (pilotage.isLoading) {
    return <Loading />;
  }
  if (pilotage.error || !pilotage.data) {
    return <ErrorState message={toApiError(pilotage.error).message} onRetry={() => void pilotage.refetch()} />;
  }

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <CardHeader title="État du stock" subtitle="Cumul de toutes les entrées et sorties, par article." />
        <Button variant="secondary" loading={exporting} onClick={() => void exportXlsx()}>
          <FileSpreadsheet size={15} /> Exporter Excel
        </Button>
      </div>
      <div className="mt-4 overflow-x-auto px-5 pb-5">
        <table className="w-full min-w-[1050px] border-collapse text-xs">
          <thead>
            <tr>
              <th colSpan={colonnes.length} className="border border-ge7-black/40 bg-ge7-black px-2 py-2 text-center text-sm font-extrabold uppercase tracking-widest text-ge7-gold-light">
                État du stock
              </th>
            </tr>
            <tr className="bg-ge7-black/[0.06]">
              {colonnes.map((h) => (
                <th key={h} className="whitespace-nowrap border border-ge7-black/40 px-2 py-1.5 text-center text-[11px] font-bold uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => {
              const anomalie = l.alerte !== "OK";
              return (
                <tr key={l.product_id} className={`transition hover:bg-ge7-gold-soft/40 ${anomalie ? "bg-amber-50/60" : "odd:bg-ge7-cream/40"}`}>
                  <td className={`${cell} font-mono font-bold whitespace-nowrap`}>{l.reference}</td>
                  <td className={cell}><span className="font-semibold">{l.designation}</span></td>
                  <td className={`${cell} text-center`}>{l.unit ?? ""}</td>
                  <td className={`${num} text-emerald-700`}>{qty(l.entrees)}</td>
                  <td className={`${num} text-rose-600`}>{qty(l.sorties)}</td>
                  <td className={`${num} font-bold ${l.stock_theorique < 0 ? "text-red-600" : ""}`}>{qty(l.stock_theorique)}</td>
                  <td className={num}>{qty(l.stock_minimum)}</td>
                  <td className={`${cell} text-center`}><AlerteCell alerte={l.alerte} /></td>
                  <td className={cell}>
                    <span className="font-bold">{money(l.prix_vente)}</span>
                  </td>
                  {voitValeur && <td className={`${num} font-bold`}>{money(l.valeur_stock ?? 0)}</td>}
                </tr>
              );
            })}
            {lignes.length === 0 && (
              <tr><td colSpan={colonnes.length} className="border border-ge7-black/15 py-8 text-center text-ge7-black/50">Aucun article en stock.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
