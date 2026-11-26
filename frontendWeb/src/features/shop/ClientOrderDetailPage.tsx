import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Check, CircleCheckBig, FileText, MapPin, PackagePlus, PartyPopper, Printer, Receipt, Truck, TriangleAlert, X } from "lucide-react";
import type { PosSale } from "@/types";
import { toApiError } from "@/lib/api";
import { datetime, money, relative } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { ErrorState, Loading } from "@/components/ui";
import { Facture } from "@/features/pos/Facture";
import { CommandeMap } from "@/features/orders/CommandeMap";
import { AnnotationsFil } from "@/features/orders/AnnotationsFil";
import { clientApi, type CommandeClient } from "./espaceClient";
import { CatalogueClient, ListeDemande, fusionner, versPayload, type LigneLocale } from "./DemandeProduits";

/**
 * Facture ou bon de livraison A4 (même modèle que le back-office) reconstruit
 * depuis la commande. Les prix ne sont présents qu'une fois la facture émise.
 */
export function documentCommande(c: CommandeClient, bl: boolean): PosSale {
  return {
    id: c.id,
    number: bl ? (c.bon_livraison?.numero ?? c.numero) : (c.facture?.numero ?? c.numero),
    created_at: bl ? (c.bon_livraison?.livre_le ?? c.livraison?.livree_le ?? c.cree_le) : (c.validee_le ?? c.cree_le),
    customer_name: c.client.nom,
    customer_phone: c.client.telephone,
    customer_address: `${c.adresse.ville} ${c.adresse.quartier}, ${c.adresse.point_repere}`,
    items: c.lignes.map((l) => ({
      id: l.id,
      product: { name: l.designation, type: null, unit: l.unite ? { symbol: l.unite } : undefined },
      quantity: l.quantite,
      delivered_quantity: l.quantite,
      remaining_quantity: 0,
      unit_price: l.prix_unitaire ?? 0,
      total: l.total_ligne ?? 0,
    })) as PosSale["items"],
    subtotal: c.sous_total ?? 0,
    discount_rate: c.remise.taux,
    tax_type: "AUCUNE",
    tax_rate: 0,
    tax_amount: 0,
    total: c.total ?? 0,
    payment_method: "LIVRAISON",
    status: c.facture?.statut_paiement === "payee" ? "PAYEE" : "EMISE",
    source: "boutique_en_ligne",
    invoice: c.facture ? ({ number: c.facture.numero } as PosSale["invoice"]) : null,
  };
}

/** Bon de livraison d'un envoi (livraison partielle) : seulement les quantités envoyées. */
function documentBon(c: CommandeClient, bon: CommandeClient["bons_livraison"][number]): PosSale {
  const base = documentCommande(c, true);
  const items = bon.lignes.map((x, i) => {
    const ligne = c.lignes.find((l) => l.designation === x.designation);
    const pu = ligne?.prix_unitaire ?? 0;
    return {
      id: i,
      product: { name: x.designation, type: null, unit: ligne?.unite ? { symbol: ligne.unite } : undefined },
      quantity: x.quantite,
      delivered_quantity: x.quantite,
      remaining_quantity: 0,
      unit_price: pu,
      total: Math.round(pu * x.quantite),
    };
  });
  const total = items.reduce((t, x) => t + x.total, 0);
  return { ...base, number: bon.numero, created_at: bon.livre_le ?? base.created_at, items: items as PosSale["items"], subtotal: total, discount_rate: 0, total };
}

/** Suivi d'une commande dans l'espace client, comme le suivi en ligne, avec annotations, facture et bon de livraison. */
export function ClientOrderDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const nouvelle = (location.state as { nouvelle?: boolean } | null)?.nouvelle;
  const qc = useQueryClient();
  const notify = useToast();
  // Document affiché : facture, dernier BL, ou BL d'un envoi précis (« bl:BL-00003-2026 »).
  const [doc, setDoc] = useState<string | null>(null);
  // Ajout de produits tant que la commande est en attente de validation.
  const [ajout, setAjout] = useState<LigneLocale[] | null>(null);

  // Rafraîchi régulièrement : validation, départ du chauffeur, position GPS.
  const { data: c, isLoading, isError } = useQuery({
    queryKey: ["client", "commande", id],
    queryFn: () => clientApi.commande(id!),
    enabled: !!id,
    refetchInterval: 120_000,
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
  const ajouterLignes = useMutation({
    mutationFn: (lignes: LigneLocale[]) => clientApi.ajouterLignes(Number(id), versPayload(lignes)),
    onSuccess: (data) => { majCache(data); setAjout(null); notify("Produits ajoutés à la commande"); },
    onError: (e) => notify(toApiError(e).message, "error"),
  });
  if (isLoading) return <Loading />;
  if (isError || !c) return <ErrorState message="Commande introuvable." />;

  const bonChoisi = doc?.startsWith("bl:") ? c.bons_livraison?.find((b) => b.numero === doc.slice(3)) : undefined;
  if (bonChoisi || (doc === "bl" && c.bon_livraison) || (doc === "facture" && c.facture)) {
    const estBl = doc !== "facture";
    return (
      <>
        <div className="no-print mb-4 flex flex-wrap items-center gap-2">
          <button onClick={() => setDoc(null)} className="inline-flex items-center gap-1.5 rounded-full border border-ge7-black/15 bg-white px-4 py-2 text-sm font-semibold"><ArrowLeft size={15} /> Retour</button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-full bg-ge7-gold px-4 py-2 text-sm font-bold text-ge7-black"><Printer size={15} /> Imprimer / PDF</button>
        </div>
        <Facture
          sale={bonChoisi ? documentBon(c, bonChoisi) : documentCommande(c, estBl)}
          originLabel={`Commande : ${c.numero}`}
          docTitle={estBl ? "BON DE LIVRAISON" : "FACTURE"}
          solde={!estBl && !!c.facture?.soldee_le}
          extras={c.extras}
        />
      </>
    );
  }

  const indisponible = ["refusee", "annulee", "echec_livraison"].includes(c.statut);
  const valideeOuPlus = ["validee", "en_preparation", "en_livraison", "livree"].includes(c.statut);
  // Prix visibles une fois la facture émise (validation de la commande).
  const prix = c.total !== null;

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
          <p><strong>Commande validée{c.validee_le ? ` le ${datetime(c.validee_le)}` : ""}.</strong> La livraison est en cours d'organisation : elle peut se faire en plusieurs envois, que vous suivez ci-dessous.</p>
        </div>
      )}

      {c.statut === "livree" && c.livraison && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="flex items-center gap-2"><Check size={17} /> <span><strong>Livrée le {datetime(c.livraison.livree_le)}</strong>{c.livraison.receptionnaire ? `, reçue par ${c.livraison.receptionnaire}` : ""}.</span></p>
          {c.bon_livraison && (
            <button onClick={() => setDoc("bl")} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-4 py-2 text-sm font-bold text-white"><FileText size={15} /> Bon de livraison {c.bon_livraison.numero}</button>
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
          <ul className="space-y-2 text-sm">
            {c.lignes.map((l) => (
              <li key={l.id} className="flex justify-between gap-3">
                <span className="min-w-0">
                  {l.designation} ({l.quantite}{l.unite ? ` ${l.unite}` : ""})
                  {l.inconnu && <span className="ml-1.5 rounded-full bg-ge7-gold-soft px-2 py-0.5 text-[10px] font-bold uppercase text-ge7-bronze">Recherche en cours</span>}
                  {l.precision && <span className="block text-xs text-ge7-black/50">{l.precision}</span>}
                  {/* Suivi des envois : livré et reste à livrer. */}
                  {valideeOuPlus && (
                    <span className="block text-xs">
                      <span className="font-semibold text-emerald-700">livré {l.quantite_livree}</span>
                      {l.reste > 0 && <span className="font-semibold text-amber-700"> · reste {l.reste}</span>}
                    </span>
                  )}
                </span>
                {prix && <span className="shrink-0 font-semibold">{money(l.total_ligne ?? 0)}</span>}
              </li>
            ))}
          </ul>
          {prix && (c.remise.montant ?? 0) > 0 && (
            <div className="mt-3 space-y-1 border-t border-ge7-black/10 pt-3 text-sm">
              <div className="flex justify-between"><span className="text-ge7-black/60">Sous-total</span><span>{money(c.sous_total ?? 0)}</span></div>
              <div className="flex justify-between text-emerald-700"><span>Remise {c.remise.taux} %</span><span>− {money(c.remise.montant ?? 0)}</span></div>
            </div>
          )}
          {c.extras.map((x) => (
            <div key={x.label} className="mt-1 flex justify-between text-sm"><span className="text-ge7-black/60">{x.label}</span><span>{money(x.amount)}</span></div>
          ))}
          {prix ? (
            <div className="mt-3 flex items-center justify-between border-t border-ge7-black/10 pt-3">
              <span className="text-sm font-bold">{c.statut === "livree" ? "Montant" : "À payer à la livraison"}</span>
              <span className="text-lg font-extrabold text-ge7-bronze">{money((c.total ?? 0) + c.extras.reduce((t, x) => t + x.amount, 0))}</span>
            </div>
          ) : (
            <p className="mt-3 border-t border-ge7-black/10 pt-3 text-xs text-ge7-black/50">Les prix vous seront communiqués sur la facture, à la validation de la commande.</p>
          )}
          {c.statut === "en_attente" && !ajout && (
            <button onClick={() => setAjout([])} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-ge7-black/15 px-4 py-2 text-sm font-semibold hover:border-ge7-gold">
              <PackagePlus size={15} /> Ajouter des produits
            </button>
          )}
          {c.note && <p className="mt-3 rounded-xl bg-ge7-black/[0.03] px-3 py-2 text-xs text-ge7-black/60">Note de livraison : {c.note}</p>}
          {(c.facture || c.bon_livraison) && (
            <div className="mt-3 space-y-1 border-t border-ge7-black/10 pt-3 text-xs text-ge7-black/60">
              {c.facture && (
                <button onClick={() => setDoc("facture")} className="flex items-center gap-1.5 font-semibold text-ge7-purple hover:underline">
                  <Receipt size={13} /> Facture {c.facture.numero}
                  {c.facture.soldee_le && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-700">Soldée</span>}
                </button>
              )}
              {c.bon_livraison && (
                <button onClick={() => setDoc("bl")} className="block font-semibold text-ge7-purple hover:underline">
                  Bon de livraison {c.bon_livraison.numero}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chaque envoi (livraison partielle) avec son bon de livraison. */}
      {(c.bons_livraison?.length ?? 0) > 0 && (
        <div className="mt-5 rounded-2xl border border-ge7-black/10 bg-white p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-bold"><Truck size={16} className="text-ge7-bronze" /> Livraisons ({c.bons_livraison.length})</p>
          <ul className="divide-y divide-ge7-black/5">
            {c.bons_livraison.map((b) => (
              <li key={b.numero} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{b.livre_le ? datetime(b.livre_le) : ""}</span>
                  <span className="block text-xs text-ge7-black/60">{b.lignes.map((x) => `${x.quantite} × ${x.designation}`).join(" · ")}</span>
                </span>
                <button onClick={() => setDoc(`bl:${b.numero}`)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-ge7-purple hover:underline">
                  <FileText size={13} /> {b.numero}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Grande fenêtre d'ajout : catalogue à gauche, produits à ajouter à droite. */}
      {ajout && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center sm:p-6" onClick={() => setAjout(null)}>
          <div
            className="relative max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-t-3xl bg-white p-4 sm:rounded-3xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-base font-bold"><PackagePlus size={18} className="text-ge7-bronze" /> Ajouter des produits à la commande {c.numero}</p>
              <p className="mt-1 text-xs text-ge7-black/50">Possible tant que la commande n'est pas validée.</p>
            </div>
            <button onClick={() => setAjout(null)} className="grid size-9 shrink-0 place-items-center rounded-full bg-ge7-black/5 hover:bg-ge7-black/10" aria-label="Fermer"><X size={18} /></button>
          </div>
          <div className="mt-4 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
            <CatalogueClient onAjouter={(l) => setAjout(fusionner(ajout, l))} />
            <div className="h-fit rounded-2xl border border-ge7-black/10 p-4 lg:sticky lg:top-0">
              <p className="mb-2 text-sm font-bold">À ajouter ({ajout.length})</p>
              <ListeDemande
                lignes={ajout}
                onQuantite={(cle, q) => setAjout(ajout.map((l) => (l.cle === cle ? { ...l, quantite: q } : l)))}
                onRetirer={(cle) => setAjout(ajout.filter((l) => l.cle !== cle))}
              />
              <div className="mt-3 flex gap-2">
                <button onClick={() => setAjout(null)} className="rounded-full border border-ge7-black/15 px-4 py-2.5 text-sm font-semibold">Annuler</button>
                <button
                  disabled={ajout.length === 0 || ajouterLignes.isPending}
                  onClick={() => ajouterLignes.mutate(ajout)}
                  className="flex-1 rounded-full bg-ge7-gold px-4 py-2.5 text-sm font-bold text-ge7-black disabled:opacity-50"
                >
                  {ajouterLignes.isPending ? "Envoi…" : "Ajouter à la commande"}
                </button>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

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
