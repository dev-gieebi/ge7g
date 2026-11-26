import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FileSpreadsheet } from "lucide-react";
import { api, toApiError } from "@/lib/api";
import type { PilotageReport } from "@/types";
import { date, money, qty } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { Button, Card, CardHeader, ErrorState, Input, Loading, SearchInput } from "@/components/ui";

/** Date locale au format AAAA-MM-JJ (champ date). */
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Raccourcis de période. */
const RACCOURCIS: { label: string; periode: () => { from: string; to: string } }[] = [
  { label: "Tout", periode: () => ({ from: "", to: "" }) },
  { label: "Ce mois", periode: () => { const n = new Date(); return { from: iso(new Date(n.getFullYear(), n.getMonth(), 1)), to: iso(n) }; } },
  {
    label: "Mois précédent",
    periode: () => { const n = new Date(); return { from: iso(new Date(n.getFullYear(), n.getMonth() - 1, 1)), to: iso(new Date(n.getFullYear(), n.getMonth(), 0)) }; },
  },
  { label: "Cette année", periode: () => { const n = new Date(); return { from: iso(new Date(n.getFullYear(), 0, 1)), to: iso(n) }; } },
];

const HEADERS = [
  "Code article", "Désignation", "Unité", "Stock initial", "Entrées",
  "Sorties", "Stock physique", "Stock réel", "Écart",
] as const;

/** Valeur du stock : Direction et Super admin uniquement. */
const VALEUR = "Valeur stock estimée (FCFA)";

const cell = "border border-ge7-black/15 px-2 py-1.5";
const num = `${cell} text-right whitespace-nowrap`;

/** Écart signé : manque en rouge, surplus en bleu, 0 en vert. */
export function EcartValeur({ ecart }: { ecart: number | null }) {
  if (ecart === null) return <span className="text-ge7-black/30">—</span>;
  if (ecart === 0) return <span className="font-bold text-emerald-700">0</span>;
  return <span className={`font-bold ${ecart < 0 ? "text-rose-600" : "text-sky-700"}`}>{ecart > 0 ? "+" : ""}{qty(ecart)}</span>;
}

/**
 * État du stock par article, sur une période (optionnelle) :
 * - Stock initial : stock au début de la période (stock en base avant les mouvements) ;
 * - Entrées / Sorties : mouvements de la période ;
 * - Stock physique : stock initial + entrées − sorties ;
 * - Stock réel : quantité comptée au dernier inventaire validé (+ mouvements depuis) ;
 * - Écart : stock réel − stock physique.
 * Direction, Super admin et approvisionneur ; la valeur du stock n'est
 * affichée qu'à la Direction et au Super admin.
 */
export function EtatStockTable() {
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  const [ecartsSeuls, setEcartsSeuls] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { user } = useAuth();
  const voitValeur = hasRole(user, "DG_ADMIN");
  const colonnes = voitValeur ? [...HEADERS, VALEUR] : [...HEADERS];
  // Une date de fin antérieure au début n'est pas envoyée.
  const periodeValide = !from || !to || to >= from;
  const params = { from: from || undefined, to: to || undefined };

  const pilotage = useQuery({
    queryKey: ["report-pilotage", from, to],
    queryFn: async () => (await api.get<{ data: PilotageReport }>("/reports/pilotage", { params })).data.data,
    enabled: periodeValide,
    placeholderData: keepPreviousData,
  });

  const exportXlsx = async () => {
    setExporting(true);
    try {
      const { data } = await api.get<Blob>("/reports/pilotage/export", { params, responseType: "blob" });
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `etat-stock${from ? `-du-${from}` : ""}-au-${to || iso(new Date())}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const libellePeriode = from && to
    ? `du ${date(from)} au ${date(to)}`
    : from ? `du ${date(from)} à aujourd'hui`
    : to ? `au ${date(to)}`
    : "depuis le début, à ce jour";

  const toutes = useMemo(() => pilotage.data?.etat_stock ?? [], [pilotage.data]);
  const avecEcart = toutes.filter((l) => l.ecart !== null && l.ecart !== 0);
  const jamaisComptes = toutes.filter((l) => l.stock_reel === null).length;

  const lignes = useMemo(() => {
    const s = search.trim().toLowerCase();
    return toutes.filter((l) =>
      (!ecartsSeuls || (l.ecart !== null && l.ecart !== 0))
      && (!s || l.reference.toLowerCase().includes(s) || l.designation.toLowerCase().includes(s)),
    );
  }, [toutes, search, ecartsSeuls]);

  if (pilotage.isLoading) {
    return <Loading />;
  }
  if (periodeValide && (pilotage.error || !pilotage.data)) {
    return <ErrorState message={toApiError(pilotage.error).message} onRetry={() => void pilotage.refetch()} />;
  }

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <CardHeader
          title="État du stock"
          subtitle={`Période : ${libellePeriode}`}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" loading={exporting} onClick={() => void exportXlsx()}>
            <FileSpreadsheet size={15} /> Exporter Excel
          </Button>
        </div>
      </div>

      {/* Période : stock initial au début, entrées/sorties de la période, stock physique et réel à la fin. */}
      <div className="mt-2 flex flex-wrap items-end gap-3 px-5">
        <Input label="Du" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        <Input
          label="Au"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => setTo(e.target.value)}
          className="w-40"
          error={periodeValide ? undefined : "Doit suivre la date de début"}
        />
        <div className="flex flex-wrap gap-1.5 pb-0.5">
          {RACCOURCIS.map((r) => {
            const p = r.periode();
            const actif = p.from === from && p.to === to;
            return (
              <button
                key={r.label}
                type="button"
                onClick={() => { setFrom(p.from); setTo(p.to); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${actif ? "bg-ge7-black text-ge7-gold-light" : "bg-ge7-black/5 text-ge7-black/70 hover:bg-ge7-gold-soft/60"}`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
        {pilotage.isFetching && <span className="pb-2 text-xs text-ge7-black/50">Mise à jour…</span>}
      </div>

      <div className="mt-4 grid gap-3 px-5 sm:grid-cols-3">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-rose-700">Articles avec écart</p>
          <p className="mt-1 text-lg font-extrabold text-rose-800">{avecEcart.length}</p>
        </div>
        <div className="rounded-2xl border border-ge7-black/10 bg-white px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ge7-black/60">Jamais inventoriés</p>
          <p className="mt-1 text-lg font-extrabold">{jamaisComptes}</p>
        </div>
        <div className="flex flex-col justify-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Code, désignation…" />
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-ge7-black/70">
            <input type="checkbox" checked={ecartsSeuls} onChange={(e) => setEcartsSeuls(e.target.checked)} className="h-4 w-4 accent-ge7-gold" />
            Afficher uniquement les écarts
          </label>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto px-5 pb-5">
        <table className="w-full min-w-[950px] border-collapse text-xs">
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
              const anomalie = l.ecart !== null && l.ecart !== 0;
              return (
                <tr key={l.product_id} className={`transition hover:bg-ge7-gold-soft/40 ${anomalie ? "bg-rose-50/60" : "odd:bg-ge7-cream/40"}`}>
                  <td className={`${cell} font-mono font-bold whitespace-nowrap`}>{l.reference}</td>
                  <td className={cell}><span className="font-semibold">{l.designation}</span></td>
                  <td className={`${cell} text-center`}>{l.unit ?? ""}</td>
                  <td className={num}>{qty(l.stock_initial)}</td>
                  <td className={`${num} text-emerald-700`}>{qty(l.entrees)}</td>
                  <td className={`${num} text-rose-600`}>{qty(l.sorties)}</td>
                  <td className={`${num} font-bold ${l.stock_theorique < 0 ? "text-red-600" : ""}`}>{qty(l.stock_theorique)}</td>
                  <td className={num} title={l.physical_stock_at ? `Compté le ${date(l.physical_stock_at)}` : "Jamais inventorié"}>
                    {l.stock_reel === null ? <span className="text-ge7-black/30">—</span> : <span className="font-bold">{qty(l.stock_reel)}</span>}
                  </td>
                  <td className={num}><EcartValeur ecart={l.ecart} /></td>
                  {voitValeur && <td className={`${num} font-bold`}>{money(l.valeur_stock ?? 0)}</td>}
                </tr>
              );
            })}
            {lignes.length === 0 && (
              <tr>
                <td colSpan={colonnes.length} className="border border-ge7-black/15 py-8 text-center text-ge7-black/50">
                  {ecartsSeuls || search ? "Aucun article ne correspond." : "Aucun article en stock."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
