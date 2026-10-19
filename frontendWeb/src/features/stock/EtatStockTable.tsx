import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, FileSpreadsheet, Save } from "lucide-react";
import { api, toApiError } from "@/lib/api";
import type { EtatStockLigne, PilotageReport } from "@/types";
import { money, qty } from "@/lib/format";
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
  "Sorties livrées", "Mouvements nets", "Stock théorique", "Stock minimum",
  "Alerte", "Prix de vente (FCFA)", "Valeur stock estimée (FCFA)",
  "Stock physique saisi", "Écart physique - théorique",
] as const;

const cell = "border border-ge7-black/15 px-2 py-1.5";
const num = `${cell} text-right whitespace-nowrap`;

/**
 * État du stock par article (classeur de suivi papier) : colonnes calculées
 * depuis les mouvements + saisie du stock physique après comptage.
 */
export function EtatStockTable() {
  const queryClient = useQueryClient();
  // Comptages physiques saisis par ligne : product_id → valeur du champ.
  const [comptages, setComptages] = useState<Record<number, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const pilotage = useQuery({
    queryKey: ["report-pilotage"],
    queryFn: async () => (await api.get<{ data: PilotageReport }>("/reports/pilotage")).data.data,
  });

  const save = useMutation({
    mutationFn: async (items: { product_id: number; physical_stock: number }[]) =>
      api.post("/reports/inventaire", { items }),
    onSuccess: async () => {
      setComptages({});
      setSaveError(null);
      await queryClient.invalidateQueries({ queryKey: ["report-pilotage"] });
    },
    onError: (e) => setSaveError(toApiError(e).message),
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

  const aEnregistrer = useMemo(
    () => Object.entries(comptages)
      .map(([id, v]) => ({ product_id: Number(id), physical_stock: Number(v) }))
      .filter((i) => i.physical_stock >= 0 && Number.isFinite(i.physical_stock)),
    [comptages],
  );

  if (pilotage.isLoading) {
    return <Loading />;
  }
  if (pilotage.error || !pilotage.data) {
    return <ErrorState message={toApiError(pilotage.error).message} onRetry={() => void pilotage.refetch()} />;
  }

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <CardHeader
          title="État du stock"
          subtitle="Colonnes calculées depuis les mouvements. Saisissez le stock physique après comptage."
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" loading={exporting} onClick={() => void exportXlsx()}>
            <FileSpreadsheet size={15} /> Exporter Excel
          </Button>
          <Button
            variant="purple"
            loading={save.isPending}
            disabled={aEnregistrer.length === 0}
            onClick={() => save.mutate(aEnregistrer)}
          >
            <Save size={15} /> Enregistrer les comptages{aEnregistrer.length > 0 ? ` (${aEnregistrer.length})` : ""}
          </Button>
        </div>
      </div>
      {saveError && <p className="px-5 pt-2 text-sm font-semibold text-red-600">{saveError}</p>}
      <div className="mt-4 overflow-x-auto px-5 pb-5">
        <table className="w-full min-w-[1250px] border-collapse text-xs">
          <thead>
            <tr>
              <th colSpan={HEADERS.length} className="border border-ge7-black/40 bg-ge7-black px-2 py-2 text-center text-sm font-extrabold uppercase tracking-widest text-ge7-gold-light">
                État du stock
              </th>
            </tr>
            <tr className="bg-ge7-black/[0.06]">
              {HEADERS.map((h) => (
                <th key={h} className="whitespace-nowrap border border-ge7-black/40 px-2 py-1.5 text-center text-[11px] font-bold uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => {
              const saisie = comptages[l.product_id];
              const ecartSaisi = saisie !== undefined && saisie !== "" ? Number(saisie) - l.stock_theorique : l.ecart;
              const anomalie = l.alerte !== "OK";
              return (
                <tr key={l.product_id} className={`transition hover:bg-ge7-gold-soft/40 ${anomalie ? "bg-amber-50/60" : "odd:bg-ge7-cream/40"}`}>
                  <td className={`${cell} font-mono font-bold whitespace-nowrap`}>{l.reference}</td>
                  <td className={cell}><span className="font-semibold">{l.designation}</span></td>
                  <td className={`${cell} text-center`}>{l.unit ?? ""}</td>
                  <td className={`${num} text-emerald-700`}>{qty(l.entrees)}</td>
                  <td className={`${num} text-rose-600`}>{qty(l.sorties)}</td>
                  <td className={num}>{qty(l.mouvements_nets)}</td>
                  <td className={`${num} font-bold ${l.stock_theorique < 0 ? "text-red-600" : ""}`}>{qty(l.stock_theorique)}</td>
                  <td className={num}>{qty(l.stock_minimum)}</td>
                  <td className={`${cell} text-center`}><AlerteCell alerte={l.alerte} /></td>
                  <td className={cell}>
                    <span className="font-bold">{money(l.prix_vente)}</span>
                  </td>
                  <td className={`${num} font-bold`}>{money(l.valeur_stock)}</td>
                  <td className={`${cell} text-center`}>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className="w-20 rounded border border-ge7-black/25 bg-white px-1.5 py-0.5 text-right focus:border-ge7-purple focus:outline-none"
                      placeholder={l.stock_physique !== null ? String(l.stock_physique) : ""}
                      value={saisie ?? ""}
                      onChange={(e) => setComptages((c) => ({ ...c, [l.product_id]: e.target.value }))}
                    />
                  </td>
                  <td className={`${num} font-bold ${ecartSaisi !== null && ecartSaisi !== 0 ? "bg-rose-50 text-red-600" : ""}`}>
                    {ecartSaisi !== null ? qty(ecartSaisi) : ""}
                  </td>
                </tr>
              );
            })}
            {lignes.length === 0 && (
              <tr><td colSpan={HEADERS.length} className="border border-ge7-black/15 py-8 text-center text-ge7-black/50">Aucun article en stock.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {lignes.some((l) => l.physical_stock_at) && (
        <p className="flex items-center gap-1.5 px-5 pb-4 text-xs text-ge7-black/50">
          <ClipboardCheck size={13} /> Dernier comptage enregistré l'écart se calcule sur le stock théorique actuel.
        </p>
      )}
    </Card>
  );
}
