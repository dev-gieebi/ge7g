import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Save, Trash2 } from "lucide-react";
import { api, del, post, put, toApiError } from "@/lib/api";
import { useOne } from "@/lib/hooks";
import { useToast } from "@/lib/toast";
import { useConfirmer } from "@/lib/confirmation";
import { datetime, qty } from "@/lib/format";
import type { InventaireDetail, PilotageReport } from "@/types";
import { Button, Card, ErrorState, Loading, ModuleTabs, PageHeader, SearchInput, Select, Textarea } from "@/components/ui";
import { APPRO_TABS } from "@/app/moduleTabs";
import { EcartValeur } from "./EtatStockTable";
import { StatutInventaire } from "./InventairesPage";

type Filtre = "" | "comptes" | "non_comptes" | "ecarts";

interface LigneSaisie {
  product_id: number;
  reference: string;
  designation: string;
  unit: string | null;
  stock_theorique: number;
}

const cell = "border border-ge7-black/15 px-2 py-1.5";
const num = `${cell} text-right whitespace-nowrap`;

/** Quantité saisie valide (vide = article non compté). */
const lire = (v: string | undefined): number | null => {
  if (v === undefined || v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/**
 * Saisie d'un inventaire : tous les articles sont listés avec leur stock
 * physique ; on tape la quantité comptée (vide = non compté). Le brouillon
 * peut être enregistré et repris ; la validation fige les écarts.
 */
export function InventaireDetailPage() {
  const { id } = useParams();
  const nouveau = id === undefined;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const notify = useToast();
  const confirmer = useConfirmer();

  const detail = useOne<InventaireDetail>("inventaire", nouveau ? null : `/inventaires/${id}`);
  const pilotage = useQuery({
    queryKey: ["report-pilotage"],
    queryFn: async () => (await api.get<{ data: PilotageReport }>("/reports/pilotage")).data.data,
  });

  const [comptes, setComptes] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState("");
  const [modifie, setModifie] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("");
  const initialise = useRef<number | null>(null);

  // Reprise d'un brouillon : on recharge ses comptages une seule fois.
  useEffect(() => {
    if (detail.data && initialise.current !== detail.data.id) {
      initialise.current = detail.data.id;
      setComptes(Object.fromEntries(detail.data.lignes.map((l) => [l.product_id, String(l.stock_compte)])));
      setNotes(detail.data.notes ?? "");
      setModifie(false);
    }
  }, [detail.data]);

  const valide = detail.data?.statut === "VALIDE";

  // Brouillon : tous les articles (stock actuel). Validé : lignes figées.
  const lignes: (LigneSaisie & { compte: number | null; ecart: number | null })[] = useMemo(() => {
    if (valide && detail.data) {
      return detail.data.lignes.map((l) => ({ ...l, compte: l.stock_compte, ecart: l.ecart }));
    }
    return (pilotage.data?.etat_stock ?? []).map((p) => {
      const compte = lire(comptes[p.product_id]);
      return {
        product_id: p.product_id,
        reference: p.reference,
        designation: p.designation,
        unit: p.unit,
        stock_theorique: p.stock_theorique,
        compte,
        ecart: compte === null ? null : Math.round((compte - p.stock_theorique) * 100) / 100,
      };
    });
  }, [valide, detail.data, pilotage.data, comptes]);

  const visibles = useMemo(() => {
    const s = search.trim().toLowerCase();
    return lignes.filter((l) => {
      if (s && !l.reference.toLowerCase().includes(s) && !l.designation.toLowerCase().includes(s)) return false;
      if (filtre === "comptes") return l.compte !== null;
      if (filtre === "non_comptes") return l.compte === null;
      if (filtre === "ecarts") return l.ecart !== null && l.ecart !== 0;
      return true;
    });
  }, [lignes, search, filtre]);

  const nbComptes = lignes.filter((l) => l.compte !== null).length;
  const nbEcarts = lignes.filter((l) => l.ecart !== null && l.ecart !== 0).length;
  const invalides = Object.entries(comptes).filter(([, v]) => v.trim() !== "" && lire(v) === null).length;

  const payload = () => ({
    notes: notes.trim() || null,
    lignes: Object.entries(comptes)
      .map(([pid, v]) => ({ product_id: Number(pid), stock_compte: lire(v) }))
      .filter((l): l is { product_id: number; stock_compte: number } => l.stock_compte !== null),
  });

  /** Enregistre le brouillon ; renvoie son id (créé au premier enregistrement). */
  const enregistrer = async (): Promise<number> => {
    if (nouveau) {
      const cree = await post<InventaireDetail>("/inventaires", payload());
      return cree.id;
    }
    await put<InventaireDetail>(`/inventaires/${id}`, payload());
    return Number(id);
  };

  const rafraichir = () => {
    void qc.invalidateQueries({ queryKey: ["inventaires"] });
    void qc.invalidateQueries({ queryKey: ["inventaire"] });
    void qc.invalidateQueries({ queryKey: ["report-pilotage"] });
  };

  const sauver = async () => {
    setBusy(true);
    try {
      const inventaireId = await enregistrer();
      setModifie(false);
      rafraichir();
      notify("Brouillon enregistré");
      if (nouveau) navigate(`/admin/inventaires/${inventaireId}`, { replace: true });
    } catch (e) {
      notify(toApiError(e).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const valider = async () => {
    const ok = await confirmer({
      titre: "Valider l'inventaire ?",
      message: (
        <>
          <p>{nbComptes} article(s) compté(s), dont <strong>{nbEcarts}</strong> avec un écart.</p>
          <p className="mt-2">Les écarts seront figés et affichés dans l'état du stock. L'inventaire ne pourra plus être modifié.</p>
        </>
      ),
      bouton: "Valider",
      danger: false,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const inventaireId = await enregistrer();
      await post(`/inventaires/${inventaireId}/valider`);
      setModifie(false);
      rafraichir();
      notify("Inventaire validé");
      if (nouveau) navigate(`/admin/inventaires/${inventaireId}`, { replace: true });
    } catch (e) {
      notify(toApiError(e).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const supprimer = async () => {
    const ok = await confirmer({ titre: "Supprimer ce brouillon ?", message: "Les comptages saisis seront perdus.", bouton: "Supprimer" });
    if (!ok) return;
    setBusy(true);
    try {
      await del(`/inventaires/${id}`);
      rafraichir();
      notify("Brouillon supprimé");
      navigate("/admin/inventaires");
    } catch (e) {
      notify(toApiError(e).message, "error");
      setBusy(false);
    }
  };

  if ((!nouveau && detail.isLoading) || (!valide && pilotage.isLoading)) return <Loading />;
  if (!nouveau && (detail.error || !detail.data)) {
    return <ErrorState message={toApiError(detail.error).message} onRetry={() => void detail.refetch()} />;
  }
  if (!valide && (pilotage.error || !pilotage.data)) {
    return <ErrorState message={toApiError(pilotage.error).message} onRetry={() => void pilotage.refetch()} />;
  }

  const inv = detail.data;

  return (
    <>
      <ModuleTabs tabs={APPRO_TABS} />
      <PageHeader
        breadcrumb={
          <button onClick={() => navigate("/admin/inventaires")} className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeft size={12} /> Inventaires
          </button>
        }
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            {inv ? inv.numero : "Nouvel inventaire"}
            {inv && <StatutInventaire statut={inv.statut} />}
          </span>
        }
        subtitle={
          inv
            ? `Créé le ${datetime(inv.created_at)}${inv.user ? ` par ${inv.user.name}` : ""}${inv.valide_le ? ` · validé le ${datetime(inv.valide_le)}${inv.valide_par ? ` par ${inv.valide_par.name}` : ""}` : ""}`
            : "Saisissez la quantité comptée pour chaque article. Laissez vide un article non compté."
        }
        action={
          !valide && (
            <>
              {inv && (
                <Button variant="ghost" disabled={busy} onClick={() => void supprimer()}>
                  <Trash2 size={15} /> Supprimer
                </Button>
              )}
              <Button variant="secondary" loading={busy} disabled={invalides > 0} onClick={() => void sauver()}>
                <Save size={15} /> Enregistrer le brouillon
              </Button>
              <Button variant="green" loading={busy} disabled={nbComptes === 0 || invalides > 0} onClick={() => void valider()}>
                <CheckCircle2 size={15} /> Valider l'inventaire
              </Button>
            </>
          )
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-ge7-black/10 bg-white px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ge7-black/60">Articles comptés</p>
          <p className="mt-1 text-lg font-extrabold">{nbComptes}{!valide && <span className="text-sm font-semibold text-ge7-black/50"> / {lignes.length}</span>}</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-rose-700">Articles avec écart</p>
          <p className="mt-1 text-lg font-extrabold text-rose-800">{nbEcarts}</p>
        </div>
        {!valide ? (
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setModifie(true); }}
            placeholder="Notes (zone comptée, équipe…)"
          />
        ) : inv?.notes ? (
          <div className="rounded-2xl border border-ge7-black/10 bg-white px-4 py-3 text-sm text-ge7-black/70">{inv.notes}</div>
        ) : null}
      </div>

      {modifie && !valide && (
        <p className="mb-3 text-xs font-semibold text-amber-700">Modifications non enregistrées.</p>
      )}

      <Card padded={false}>
        <div className="grid gap-3 px-5 pt-4 sm:grid-cols-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Code, désignation…" className="sm:col-span-2" />
          <Select value={filtre} onChange={(e) => setFiltre(e.target.value as Filtre)}>
            <option value="">Tous les articles</option>
            <option value="comptes">Comptés</option>
            {!valide && <option value="non_comptes">Non comptés</option>}
            <option value="ecarts">Avec écart</option>
          </Select>
        </div>
        <div className="mt-4 overflow-x-auto px-5 pb-5">
          <table className="w-full min-w-[760px] border-collapse text-xs">
            <thead>
              <tr className="bg-ge7-black/[0.06]">
                {["Code article", "Désignation", "Unité", valide ? "Stock physique (au comptage)" : "Stock physique", "Stock réel (compté)", "Écart"].map((h) => (
                  <th key={h} className="whitespace-nowrap border border-ge7-black/40 px-2 py-1.5 text-center text-[11px] font-bold uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((l) => {
                const saisie = comptes[l.product_id] ?? "";
                const erreur = saisie.trim() !== "" && lire(saisie) === null;
                return (
                  <tr key={l.product_id} className={`transition hover:bg-ge7-gold-soft/40 ${l.ecart ? "bg-rose-50/60" : "odd:bg-ge7-cream/40"}`}>
                    <td className={`${cell} font-mono font-bold whitespace-nowrap`}>{l.reference}</td>
                    <td className={cell}><span className="font-semibold">{l.designation}</span></td>
                    <td className={`${cell} text-center`}>{l.unit ?? ""}</td>
                    <td className={`${num} font-bold`}>{qty(l.stock_theorique)}</td>
                    <td className={`${cell} w-36`}>
                      {valide ? (
                        <div className="text-right font-bold">{qty(l.compte)}</div>
                      ) : (
                        <input
                          type="text"
                          inputMode="decimal"
                          value={saisie}
                          placeholder="Non compté"
                          aria-label={`Quantité comptée : ${l.designation}`}
                          onChange={(e) => {
                            const v = e.target.value;
                            setComptes((c) => ({ ...c, [l.product_id]: v }));
                            setModifie(true);
                          }}
                          className={`ge7-input !py-1 text-right ${erreur ? "border-rose-400" : ""}`}
                        />
                      )}
                    </td>
                    <td className={num}><EcartValeur ecart={l.ecart} /></td>
                  </tr>
                );
              })}
              {visibles.length === 0 && (
                <tr><td colSpan={6} className="border border-ge7-black/15 py-8 text-center text-ge7-black/50">Aucun article ne correspond.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
