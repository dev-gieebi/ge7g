import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, BadgePercent, Check, CircleCheckBig, FileText, MapPin, PartyPopper, Printer, Truck, TriangleAlert } from "lucide-react";
import type { PosSale } from "@/types";
import { toApiError } from "@/lib/api";
import { datetime, money, relative } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { ErrorState, Loading } from "@/components/ui";
import { Facture } from "@/features/pos/Facture";
import { CommandeMap } from "@/features/orders/CommandeMap";
import { AnnotationsFil } from "@/features/orders/AnnotationsFil";
import { clientApi, type CommandeClient } from "./espaceClient";

const field = "w-full rounded-xl border border-ge7-black/15 bg-white px-3.5 py-2.5 text-sm focus:border-ge7-gold focus:outline-none";

/** Bon de livraison A4 (même modèle que le back-office) reconstruit depuis la commande. */
function bonDeLivraison(c: CommandeClient): PosSale {
  return {
    id: c.id,
    number: c.bon_livraison?.numero ?? c.numero,
    created_at: c.bon_livraison?.livre_le ?? c.livraison?.livree_le ?? c.cree_le,
    customer_name: c.client.nom,
    customer_phone: c.client.telephone,
    customer_address: `${c.adresse.ville} ${c.adresse.quartier}, ${c.adresse.point_repere}`,
    items: c.lignes.map((l) => ({
      id: l.id,
      product: { name: l.designation, type: null, unit: l.unite ? { symbol: l.unite } : undefined },
      quantity: l.quantite,
      delivered_quantity: l.quantite,
      remaining_quantity: 0,
      unit_price: l.prix_unitaire,
      total: l.total_ligne,
    })) as PosSale["items"],
    subtotal: c.sous_total,
    discount_rate: c.remise.taux,
    tax_type: "AUCUNE",
    tax_rate: 0,
    tax_amount: 0,
    total: c.total,
    payment_method: "LIVRAISON",
    status: c.facture?.statut_paiement === "payee" ? "PAYEE" : "EMISE",
    source: "boutique_en_ligne",
    invoice: c.facture ? ({ number: c.facture.numero } as PosSale["invoice"]) : null,
  };
}

/** Suivi d'une commande dans l'espace client, comme le suivi en ligne, avec remise, annotations et bon de livraison. */
export function ClientOrderDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const nouvelle = (location.state as { nouvelle?: boolean } | null)?.nouvelle;
  const qc = useQueryClient();
  const notify = useToast();
  const [bl, setBl] = useState(false);
  const [remise, setRemise] = useState<{ taux: string; motif: string } | null>(null);

  // Rafraîchi régulièrement : validation, départ du chauffeur, position GPS.
  const { data: c, isLoading, isError } = useQuery({
    queryKey: ["client", "commande", id],
    queryFn: () => clientApi.commande(id!),
    enabled: !!id,
    refetchInterval: 20_000,
  });

  const majCache = (data: CommandeClient) => {
    qc.setQueryData(["client", "commande", id], data);
    void qc.invalidateQueries({ queryKey: ["client", "commandes"] });
  };
  const annoter = useMutation({
    mutationFn: (contenu: string) => clientApi.annoter(Number(id), contenu),
    onSuccess: (data) => { majCache(data); notify("Annotation envoyée"); },
    onError: (e) => notify(toApiError(e).message, "error"),
  });
  const demanderRemise = useMutation({
    mutationFn: (v: { taux: string; motif: string }) => clientApi.demanderRemise(Number(id), Number(v.taux), v.motif.trim() || undefined),
    onSuccess: (data) => { majCache(data); setRemise(null); notify("Demande de remise envoyée"); },
    onError: (e) => notify(toApiError(e).message, "error"),
  });

  if (isLoading) return <Loading />;
  if (isError || !c) return <ErrorState message="Commande introuvable." />;

  if (bl && c.bon_livraison) {
    return (
      <>
        <div className="no-print mb-4 flex flex-wrap items-center gap-2">
          <button onClick={() => setBl(false)} className="inline-flex items-center gap-1.5 rounded-full border border-ge7-black/15 bg-white px-4 py-2 text-sm font-semibold"><ArrowLeft size={15} /> Retour</button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-full bg-ge7-gold px-4 py-2 text-sm font-bold text-ge7-black"><Printer size={15} /> Imprimer / PDF</button>
        </div>
        <Facture sale={bonDeLivraison(c)} originLabel={`Commande : ${c.numero}`} docTitle="BON DE LIVRAISON" extras={c.extras} />
      </>
    );
  }

  const indisponible = ["refusee", "annulee", "echec_livraison"].includes(c.statut);
  const valideeOuPlus = ["validee", "en_preparation", "en_livraison", "livree"].includes(c.statut);
  const peutDemanderRemise = c.statut === "en_attente" && c.remise.statut !== "accordee" && c.remise.statut !== "demandee";

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/mon-compte/commandes" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ge7-purple hover:underline">
        <ArrowLeft size={15} /> Mes commandes
      </Link>

      {nouvelle && c.statut === "en_attente" && (
        <div className="mt-3 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <PartyPopper size={18} className="mt-0.5 shrink-0" />
          <p><strong>Commande enregistrée.</strong> Notre équipe logistique va vérifier la disponibilité des produits et la valider ; vous serez informé ici.</p>
        </div>
      )}

      <div className="mt-3 rounded-2xl bg-[#151515] p-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs text-white/50">Commande</p>
            <p className="font-mono text-xl font-extrabold">{c.numero}</p>
          </div>
          <span className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${indisponible ? "bg-rose-500/20 text-rose-200" : "bg-ge7-gold/20 text-ge7-gold-light"}`}>{c.statut_libelle}</span>
        </div>
        <p className="mt-1 text-xs text-white/50">Passée le {datetime(c.cree_le)} · {c.adresse.quartier}, {c.adresse.ville}</p>
        {c.chauffeur && c.statut === "en_livraison" && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2.5 text-sm">
            <Truck size={16} className="text-ge7-gold" /> <span><strong>{c.chauffeur}</strong> est en route avec votre commande.</span>
          </p>
        )}
      </div>

      {/* Confirmation de validation : produits disponibles et réservés. */}
      {valideeOuPlus && c.statut !== "livree" && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <CircleCheckBig size={18} className="mt-0.5 shrink-0" />
          <p><strong>Commande validée{c.validee_le ? ` le ${datetime(c.validee_le)}` : ""}.</strong> Les produits sont disponibles et réservés pour vous ; la livraison est en cours d'organisation.</p>
        </div>
      )}

      {c.statut === "livree" && c.livraison && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="flex items-center gap-2"><Check size={17} /> <span><strong>Livrée le {datetime(c.livraison.livree_le)}</strong>{c.livraison.receptionnaire ? `, reçue par ${c.livraison.receptionnaire}` : ""}.</span></p>
          {c.bon_livraison && (
            <button onClick={() => setBl(true)} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-4 py-2 text-sm font-bold text-white"><FileText size={15} /> Bon de livraison {c.bon_livraison.numero}</button>
          )}
        </div>
      )}

      {c.statut === "en_livraison" && (
        <div className="mt-4">
          {c.position ? (
            <>
              <CommandeMap latitude={c.position.latitude} longitude={c.position.longitude} majLe={c.position.maj_le} label={`${c.chauffeur ?? "Le chauffeur"} · commande ${c.numero}`} height="h-80" />
              <p className="mt-2 flex items-center gap-1.5 text-xs text-ge7-black/50"><MapPin size={13} className="text-ge7-purple" /> Position actualisée {relative(c.position.maj_le)}.</p>
            </>
          ) : (
            <p className="flex items-center gap-2 rounded-2xl border border-ge7-black/10 bg-white px-4 py-3 text-sm text-ge7-black/60"><MapPin size={15} className="text-ge7-purple" /> En attente de la position du chauffeur…</p>
          )}
        </div>
      )}

      {c.motif && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <TriangleAlert size={17} className="mt-0.5 shrink-0 text-amber-600" />
          <div><p className="font-bold text-amber-900">{c.statut_libelle}</p><p className="text-amber-800">{c.motif}</p></div>
        </div>
      )}

      <div className="mt-5 grid gap-5 md:grid-cols-[1fr_1.3fr]">
        <div className="rounded-2xl border border-ge7-black/10 bg-white p-5">
          <p className="mb-4 text-sm font-bold">Progression</p>
          <ol>
            {c.etapes.map((e, i) => {
              const active = e.statut === c.statut;
              const done = !!e.franchie_le;
              return (
                <li key={e.statut} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${done ? "bg-ge7-gold text-ge7-black" : "border-2 border-ge7-black/15 text-ge7-black/30"} ${active ? "ring-4 ring-ge7-gold/30" : ""}`}>
                      {done ? <Check size={14} /> : i + 1}
                    </span>
                    {i < c.etapes.length - 1 && <span className={`h-8 w-0.5 ${done ? "bg-ge7-gold" : "bg-ge7-black/10"}`} />}
                  </div>
                  <div className="pb-6 pt-0.5">
                    <p className={`text-sm font-semibold ${done ? "" : "text-ge7-black/35"} ${active ? "text-ge7-bronze" : ""}`}>{e.libelle}</p>
                    {e.franchie_le && <p className="text-xs text-ge7-black/50">{datetime(e.franchie_le)}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="rounded-2xl border border-ge7-black/10 bg-white p-5">
          <p className="mb-3 text-sm font-bold">Récapitulatif</p>
          <ul className="space-y-1.5 text-sm">
            {c.lignes.map((l) => (
              <li key={l.id} className="flex justify-between gap-3">
                <span className="min-w-0">{l.quantite} {l.unite ?? ""} × {l.designation}</span>
                <span className="shrink-0 font-semibold">{money(l.total_ligne)}</span>
              </li>
            ))}
          </ul>
          {c.remise.montant > 0 && (
            <div className="mt-3 space-y-1 border-t border-ge7-black/10 pt-3 text-sm">
              <div className="flex justify-between"><span className="text-ge7-black/60">Sous-total</span><span>{money(c.sous_total)}</span></div>
              <div className="flex justify-between text-emerald-700"><span>Remise {c.remise.taux} %</span><span>− {money(c.remise.montant)}</span></div>
            </div>
          )}
          {c.extras.map((x) => (
            <div key={x.label} className="mt-1 flex justify-between text-sm"><span className="text-ge7-black/60">{x.label}</span><span>{money(x.amount)}</span></div>
          ))}
          <div className="mt-3 flex items-center justify-between border-t border-ge7-black/10 pt-3">
            <span className="text-sm font-bold">{c.statut === "livree" ? "Montant" : "À payer à la livraison"}</span>
            <span className="text-lg font-extrabold text-ge7-bronze">{money(c.total + c.extras.reduce((t, x) => t + x.amount, 0))}</span>
          </div>
          {c.note && <p className="mt-3 rounded-xl bg-ge7-black/[0.03] px-3 py-2 text-xs text-ge7-black/60">Note de livraison : {c.note}</p>}
          {(c.facture || c.bon_livraison) && (
            <div className="mt-3 space-y-1 border-t border-ge7-black/10 pt-3 text-xs text-ge7-black/60">
              {c.facture && <p>Facture <strong className="text-ge7-black">{c.facture.numero}</strong></p>}
              {c.bon_livraison && (
                <button onClick={() => setBl(true)} className="block font-semibold text-ge7-purple hover:underline">
                  Bon de livraison {c.bon_livraison.numero}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Remise : demande, décision de l'équipe. */}
      <div className="mt-5 rounded-2xl border border-ge7-black/10 bg-white p-5">
        <p className="flex items-center gap-2 text-sm font-bold"><BadgePercent size={16} className="text-ge7-bronze" /> Remise</p>
        {c.remise.statut === "demandee" && (
          <p className="mt-2 text-sm text-ge7-black/70">Demande de <strong>{c.remise.taux_demande} %</strong> en cours d'étude{c.remise.motif ? ` (« ${c.remise.motif} »)` : ""}.</p>
        )}
        {c.remise.statut === "accordee" && (
          <p className="mt-2 text-sm text-emerald-700">Remise de <strong>{c.remise.taux} %</strong> accordée : − {money(c.remise.montant)}.</p>
        )}
        {c.remise.statut === "refusee" && <p className="mt-2 text-sm text-rose-700">Votre demande de remise n'a pas été retenue.</p>}
        {!c.remise.statut && !peutDemanderRemise && <p className="mt-2 text-sm text-ge7-black/50">Aucune remise sur cette commande.</p>}

        {peutDemanderRemise && !remise && (
          <button onClick={() => setRemise({ taux: "", motif: "" })} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-ge7-black/15 px-4 py-2 text-sm font-semibold hover:border-ge7-gold">
            <BadgePercent size={14} /> {c.remise.statut === "refusee" ? "Faire une nouvelle demande" : "Demander une remise"}
          </button>
        )}
        {remise && (
          <div className="mt-3 grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-ge7-black/60">Remise (%)</label>
              <input type="number" min={0.5} max={100} step="0.5" className={field} value={remise.taux} onChange={(e) => setRemise({ ...remise, taux: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-ge7-black/60">Motif</label>
              <input maxLength={500} className={field} value={remise.motif} onChange={(e) => setRemise({ ...remise, motif: e.target.value })} placeholder="Ex. commande en volume" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setRemise(null)} className="rounded-full border border-ge7-black/15 px-4 py-2.5 text-sm font-semibold">Annuler</button>
              <button
                disabled={!(Number(remise.taux) > 0) || demanderRemise.isPending}
                onClick={() => demanderRemise.mutate(remise)}
                className="rounded-full bg-ge7-gold px-4 py-2.5 text-sm font-bold text-ge7-black disabled:opacity-50"
              >
                Envoyer
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-ge7-black/10 bg-white p-5">
        <p className="mb-3 text-sm font-bold">Annotations</p>
        <AnnotationsFil
          annotations={c.annotations}
          moi="client"
          onEnvoyer={(contenu) => annoter.mutateAsync(contenu)}
          envoi={annoter.isPending}
          placeholder="Signaler quelque chose à l'équipe sur cette commande…"
        />
      </div>

      <div className="mt-5 rounded-2xl border border-ge7-black/10 bg-white p-5">
        <p className="mb-3 text-sm font-bold">Journal de la commande</p>
        <ol className="relative ml-2 space-y-3 border-l border-ge7-black/10 pl-5">
          {c.journal.map((h, i) => (
            <li key={i} className="text-sm">
              <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-ge7-gold" />
              <p className="font-semibold">{h.commentaire ?? h.libelle}</p>
              <p className="text-xs text-ge7-black/50">{datetime(h.created_at)}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
