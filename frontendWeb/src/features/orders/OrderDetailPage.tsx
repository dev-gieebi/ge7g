import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  BadgePercent,
  MessageSquareText,
  Ban,
  Check,
  PackageSearch,
  Pencil,
  Plus,
  ClipboardList,
  FileDown,
  // [CHAUFFEUR] MapPin, (bouton « Démarrer la mission »)
  PackageCheck,
  Printer,
  // [CHAUFFEUR] RotateCcw, (effacer la signature)
  Truck,
  TriangleAlert,
  X,
} from "lucide-react";
import type { CommandeDetail, PosSale } from "@/types";
import { useAction, useOne } from "@/lib/hooks";
// [CHAUFFEUR] import { useChauffeurs } from "@/features/shared/refData";
import { useProductsRef } from "@/features/shared/refData";
import { api } from "@/lib/api";
import { datetime, money } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useConfirmer } from "@/lib/confirmation";
import { hasRole } from "@/lib/rbac";
import { Badge, Button, Card, CardHeader, ErrorState, Input, Loading, Modal, PageHeader, Select, StatusBadge, Textarea } from "@/components/ui";
// [CHAUFFEUR] import { SignaturePad, type SignaturePadRef } from "./SignaturePad";
import { Facture } from "@/features/pos/Facture";
import { CommandeMap } from "./CommandeMap";
import { AnnotationsFil } from "./AnnotationsFil";
import { FRISE } from "./statuts";

const KEYS = ["commande", "commandes", "commande-stats"];

type MotifAction = "refuser" | "annuler" | "echec";

/**
 * Document A4 (facture ou bon de livraison) de la commande, au même modèle
 * que l'achat en caisse, `PosSale` minimal reconstruit depuis la commande.
 */
function saleDepuisCommande(c: CommandeDetail, numero: string): PosSale {
  const montant = c.facture?.montant_total ?? c.total;
  return {
    id: c.id,
    number: numero,
    created_at: c.validee_le ?? c.cree_le,
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
    // Remise accordée au client : sous-total brut + taux, le document affiche la remise.
    subtotal: c.remise.montant > 0 ? c.sous_total : montant,
    discount_rate: c.remise.montant > 0 ? c.remise.taux : 0,
    tax_type: "AUCUNE",
    tax_rate: 0,
    tax_amount: 0,
    total: montant,
    payment_method: "LIVRAISON",
    status: c.facture?.statut_paiement === "payee" ? "PAYEE" : c.facture?.statut_paiement === "annulee" ? "ANNULEE" : "EMISE",
    source: "boutique_en_ligne",
    invoice: c.facture ? ({ number: c.facture.numero } as PosSale["invoice"]) : null,
  };
}

export function OrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const confirmer = useConfirmer();
  const peutGerer = hasRole(user, "LG_ADMIN", "DG_ADMIN");
  // Seul le DG accorde ou refuse une remise demandée par le client.
  const peutDeciderRemise = hasRole(user, "DG_ADMIN");
  // [CHAUFFEUR] Affectation du chauffeur en pause (voir CHAUFFEUR.md).
  // const peutAffecter = hasRole(user, "LG_ADMIN", "DG_ADMIN", "CDG_ADMIN");
  const estChauffeur = user?.role === "CHAUFFEUR";
  const peutLivrer = hasRole(user, "LG_ADMIN", "DG_ADMIN", "CHAUFFEUR");

  // Pendant la livraison, la carte suit la position du chauffeur (15 s).
  const commande = useOne<CommandeDetail>("commande", id ? `/commandes/${id}` : null, 15_000);
  // [CHAUFFEUR] const { data: chauffeurs, isError: errChauffeurs, refetch: refetchChauffeurs } = useChauffeurs(!estChauffeur);

  const [motif, setMotif] = useState<{ action: MotifAction; valeur: string } | null>(null);
  // [CHAUFFEUR] const [expedier, setExpedier] = useState<{ chauffeur_id?: number } | null>(null);
  // [CHAUFFEUR] Livraison avec réceptionnaire, encaissement et signature (voir CHAUFFEUR.md).
  // const [livrer, setLivrer] = useState<{ receptionnaire: string; montant: string; mode: string } | null>(null);
  const [impression, setImpression] = useState<"facture" | "bl" | null>(null);
  // Ligne à référencer (produit demandé hors catalogue) ou prix à ajuster, avant validation.
  const [ligneEdit, setLigneEdit] = useState<{ id: number; designation: string; precision?: string | null; inconnu: boolean; produit_id: string; prix: string; filtre: string } | null>(null);
  // Fenêtre « Commentaires » : annotations, remise et données complètes de la commande.
  const [commentaires, setCommentaires] = useState(false);
  const [tauxRemise, setTauxRemise] = useState<string | null>(null);
  // Frais annexes (manutention, livraison…) : chargés depuis la commande, enregistrés en base.
  const [extras, setExtras] = useState<{ label: string; amount: number }[]>([]);
  // Position locale du chauffeur (même source que le partage GPS) : la carte
  // s'affiche pour lui dès le départ, sans attendre le retour du serveur.
  const [maPosition, setMaPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  // [CHAUFFEUR] const signature = useRef<SignaturePadRef>(null);

  const valider = useAction(() => `/commandes/${id}/valider`, { keys: KEYS, success: "Commande validée facture et vente créées" });
  const preparer = useAction(() => `/commandes/${id}/preparer`, { keys: KEYS, success: "Commande passée en préparation" });
  const actionMotif = useAction<{ action: MotifAction; valeur: string }>(
    (v) => `/commandes/${id}/${v.action}`,
    { keys: KEYS, success: "Statut mis à jour", body: (v) => ({ motif: v.valeur }) },
  );
  // [CHAUFFEUR] const doAffecter = useAction<{ chauffeur_id?: number }>(() => `/commandes/${id}/affecter`, { keys: KEYS, success: "Chauffeur affecté à la commande", body: (v) => v });
  const doDemarrer = useAction<{ latitude?: number; longitude?: number }>(() => `/commandes/${id}/demarrer`, { keys: KEYS, success: "Mission démarrée bonne route !", body: (v) => v });
  // [CHAUFFEUR] Avec le chauffeur : réceptionnaire, montant, mode et signature envoyés ici.
  // const doLivrer = useAction<{ receptionnaire: string; montant: string; mode: string; signature?: string | null }>(
  //   () => `/commandes/${id}/livrer`,
  //   { keys: KEYS, success: "Livraison enregistrée", body: (v) => v },
  // );
  // En attendant : un simple clic marque la commande livrée.
  const doLivrer = useAction(() => `/commandes/${id}/livrer`, { keys: KEYS, success: "Commande marquée livrée" });
  const modifierLigne = useAction<{ ligne: number; produit_id?: number; prix_unitaire?: number }>(
    (v) => `/commandes/${id}/lignes/${v.ligne}`,
    { keys: KEYS, success: "Ligne mise à jour", body: ({ produit_id, prix_unitaire }) => ({ produit_id, prix_unitaire }) },
  );
  const solder = useAction(() => `/commandes/${id}/solder`, { keys: KEYS, success: "Facture soldée" });
  const { data: produits } = useProductsRef();
  const annoter = useAction<{ contenu: string }>(() => `/commandes/${id}/annotations`, { keys: KEYS, success: "Annotation ajoutée", body: (v) => v });
  const decision = useAction<{ decision: "accorder" | "refuser"; taux?: number }>(
    () => `/commandes/${id}/remise`,
    { keys: KEYS, success: "Décision de remise enregistrée", body: (v) => v },
  );
  const saveExtras = useAction<{ extras: { label: string; amount: number }[] }, CommandeDetail>(
    () => `/commandes/${id}/extras`,
    { keys: KEYS, success: "Frais annexes enregistrés", body: (v) => v },
  );

  // Frais annexes persistés : on charge ceux enregistrés sur la commande.
  useEffect(() => {
    if (commande.data?.extras) {
      setExtras(commande.data.extras);
    }
  }, [commande.data?.id, commande.data?.extras]);

  const enLivraison = commande.data?.statut === "en_livraison";

  // En cours de livraison, le chauffeur partage sa position en continu.
  useEffect(() => {
    if (!estChauffeur || !enLivraison || !id || !navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        setMaPosition({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        void api.post(`/commandes/${id}/position`, {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [estChauffeur, enLivraison, id]);

  if (commande.isLoading) return <Loading />;
  if (!commande.data) return <ErrorState message="Commande introuvable" />;
  const c = commande.data;

  /* [CHAUFFEUR] Départ de la mission par le chauffeur : position GPS réelle récupérée au clic.
  const demarrerMission = () => {
    if (!navigator.geolocation) {
      doDemarrer.mutate({});
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMaPosition({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        doDemarrer.mutate({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      // Position refusée : la mission démarre quand même, la carte restera vide.
      () => doDemarrer.mutate({}),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };
  */

  const stockInsuffisant = c.statut === "en_attente" && c.lignes.some((l) => l.produit_id !== null && l.stock_disponible < l.quantite);
  // Produits demandés par le client hors catalogue : à référencer avant validation.
  const aReferencer = c.lignes.filter((l) => l.produit_id === null).length;
  // Prix laissés vides (commande sans ville tarifaire) : saisis par l'équipe avant validation.
  const prixASaisir = c.lignes.filter((l) => l.produit_id !== null && l.prix_unitaire <= 0).length;
  const solde = !!c.facture?.soldee_le;
  // Le bon de livraison accompagne la commande dès sa validation.
  const imprimable = ["validee", "en_preparation", "en_livraison", "livree"].includes(c.statut);

  /* [CHAUFFEUR] Confirmation de livraison avec signature (voir CHAUFFEUR.md).
  const confirmerLivraison = () => {
    if (!livrer) return;
    doLivrer
      .mutateAsync({ ...livrer, montant: livrer.montant, signature: signature.current?.dataUrl() ?? null })
      .then(() => setLivrer(null))
      .catch(() => {});
  };
  */

  // Aperçu d'impression : même modèle A4 que la facture d'achat caisse,
  // avec la mention « Commande en ligne » pour distinguer la provenance.
  if (impression) {
    const estBl = impression === "bl";
    // Le BL généré à la livraison porte son propre numéro (BL-xxxxx-AAAA) ; avant, aperçu au n° de commande.
    const sale = saleDepuisCommande(c, estBl ? (c.bon_livraison?.numero ?? c.numero) : (c.facture?.numero ?? c.numero));
    if (estBl && c.bon_livraison?.livre_le) sale.created_at = c.bon_livraison.livre_le;

    return (
      <>
        <div className="no-print mb-4 flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setImpression(null)}><ArrowLeft size={16} /> Retour</Button>
          {!estBl && (
            solde ? (
              <Badge tone="red"><BadgeCheck size={14} /> Soldée le {datetime(c.facture!.soldee_le!)}</Badge>
            ) : (
              peutGerer && c.facture && (
                <Button
                  variant="purple"
                  loading={solder.isPending}
                  onClick={async () => {
                    if (await confirmer({ titre: "Facture soldée ?", message: "Marquer cette facture comme soldée ? Le tampon « Soldé » sera définitif, visible aussi par le client.", bouton: "Marquer soldée", danger: false })) solder.mutate();
                  }}
                >
                  <BadgeCheck size={16} /> Soldé
                </Button>
              )
            )
          )}
          <Button onClick={() => window.print()}><Printer size={16} /> Imprimer / PDF</Button>
        </div>
        {!estBl && !solde && (
          <Card className="no-print mx-auto mb-4 max-w-3xl" padded>
            <h3 className="text-sm font-extrabold text-ge7-black/80">Frais annexes</h3>
            <p className="mt-0.5 text-xs text-ge7-black/50">Manutention, coût de livraison… chaque ligne s'ajoute au TOTAL TTC du document.</p>
            {extras.map((x, i) => (
              <div key={i} className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Libellé (ex. Manutention)"
                  value={x.label}
                  onChange={(e) => setExtras((xs) => xs.map((it, j) => (j === i ? { ...it, label: e.target.value } : it)))}
                  className="min-w-0 flex-1 rounded-lg border border-ge7-black/10 px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="Montant"
                  value={x.amount || ""}
                  onChange={(e) => setExtras((xs) => xs.map((it, j) => (j === i ? { ...it, amount: Number(e.target.value) } : it)))}
                  className="w-32 rounded-lg border border-ge7-black/10 px-2 py-1.5 text-right text-sm"
                />
                <button onClick={() => setExtras((xs) => xs.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-ge7-black/40 hover:bg-red-50 hover:text-red-600" title="Retirer">
                  <X size={15} />
                </button>
              </div>
            ))}
            <div className="mt-2 flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => setExtras((xs) => [...xs, { label: "", amount: 0 }])}>
                <Plus size={14} /> Ajouter un frais
              </Button>
              <Button
                size="sm"
                variant="purple"
                loading={saveExtras.isPending}
                onClick={() =>
                  saveExtras.mutateAsync({
                    extras: extras.filter((x) => x.label.trim() !== "" && x.amount > 0),
                  }).catch(() => {})
                }
              >
                Enregistrer
              </Button>
            </div>
          </Card>
        )}
        <Facture sale={sale} originLabel={`Commande en ligne : ${c.numero}`} docTitle={estBl ? "BON DE LIVRAISON" : "FACTURE"} solde={solde} extras={extras} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link to={estChauffeur ? "/admin/mes-livraisons" : "/admin/commandes"} className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeft size={12} /> {estChauffeur ? "Mes livraisons" : "Commandes en ligne"}
          </Link>
        }
        title={c.numero}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={c.statut} />
            <span className="text-ge7-black/60">reçue le {datetime(c.cree_le)}</span>
            {c.motif && <Badge tone="red">{c.motif}</Badge>}
          </span>
        }
        action={
          <>
            {imprimable && (
              <Button variant="secondary" onClick={() => setImpression("bl")}><Printer size={16} /> {c.bon_livraison ? `BL ${c.bon_livraison.numero}` : "Bon de livraison"}</Button>
            )}
            <Button variant="secondary" onClick={() => setCommentaires(true)}>
              <MessageSquareText size={16} /> Commentaires
              {(c.annotations?.length ?? 0) > 0 && <Badge tone="gold">{c.annotations!.length}</Badge>}
              {c.remise.statut === "demandee" && <Badge tone="amber">remise</Badge>}
            </Button>
            {c.facture && (
              <Button variant="secondary" onClick={() => setImpression("facture")}><FileDown size={16} /> Facture PDF</Button>
            )}
            {peutGerer && c.statut === "en_attente" && (
              <>
                <Button variant="danger" onClick={() => setMotif({ action: "refuser", valeur: "" })}><X size={16} /> Refuser</Button>
                <Button onClick={() => valider.mutate()} loading={valider.isPending} disabled={c.remise.statut === "demandee" || aReferencer > 0 || prixASaisir > 0 || stockInsuffisant} title={c.remise.statut === "demandee" ? "Remise en attente de décision du DG" : aReferencer > 0 ? "Produits demandés à référencer" : prixASaisir > 0 ? "Prix à saisir" : stockInsuffisant ? "Stock insuffisant" : undefined}><Check size={16} /> Valider</Button>
              </>
            )}
            {peutGerer && c.statut === "validee" && (
              <>
                <Button variant="danger" onClick={() => setMotif({ action: "annuler", valeur: "" })}><Ban size={16} /> Annuler</Button>
                <Button variant="purple" onClick={() => preparer.mutate()} loading={preparer.isPending}><ClipboardList size={16} /> Passer en préparation</Button>
              </>
            )}
            {/* [CHAUFFEUR] Affectation du chauffeur et départ de mission par le chauffeur (voir CHAUFFEUR.md).
            {peutAffecter && ["validee", "en_preparation", "echec_livraison"].includes(c.statut) && (
              <Button variant="purple" onClick={() => { setExpedier({}); void refetchChauffeurs(); }}><Truck size={16} /> {c.chauffeur ? "Réaffecter" : "Affecter un chauffeur"}</Button>
            )}
            {estChauffeur && c.chauffeur?.id === user?.id && ["validee", "en_preparation", "echec_livraison"].includes(c.statut) && (
              <Button onClick={demarrerMission} loading={doDemarrer.isPending}><MapPin size={16} /> Démarrer la mission</Button>
            )}
            */}
            {/* [CHAUFFEUR] En attendant la partie chauffeur : le gestionnaire met lui-même la commande en livraison. */}
            {peutGerer && ["validee", "en_preparation", "echec_livraison"].includes(c.statut) && (
              <Button variant="purple" onClick={() => doDemarrer.mutate({})} loading={doDemarrer.isPending}><Truck size={16} /> Mettre en livraison</Button>
            )}
            {peutGerer && (c.statut === "en_preparation" || c.statut === "echec_livraison") && (
              <Button variant="danger" onClick={() => setMotif({ action: "annuler", valeur: "" })}><Ban size={16} /> Annuler</Button>
            )}
            {peutLivrer && c.statut === "en_livraison" && (
              <>
                <Button variant="danger" onClick={() => setMotif({ action: "echec", valeur: "" })}><TriangleAlert size={16} /> Échec de livraison</Button>
                {/* [CHAUFFEUR] <Button onClick={() => setLivrer({ receptionnaire: "", montant: String(c.facture?.montant_total ?? c.total), mode: "ESPECES" })}><PackageCheck size={16} /> Confirmer la livraison</Button> */}
                <Button
                  loading={doLivrer.isPending}
                  onClick={async () => {
                    if (await confirmer({ titre: "Commande livrée ?", message: `Marquer la commande ${c.numero} comme livrée ? Le bon de livraison sera créé.`, bouton: "Marquer livrée", danger: false })) doLivrer.mutate();
                  }}
                >
                  <PackageCheck size={16} /> Livrée
                </Button>
              </>
            )}
          </>
        }
      />

      {c.remise.statut === "demandee" && c.statut === "en_attente" && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-ge7-gold/50 bg-ge7-gold-soft/40 px-4 py-3 text-sm">
          <span><strong>Remise demandée par le client : {c.remise.taux_demande} %</strong>{c.remise.motif ? ` (« ${c.remise.motif} »)` : ""}. {peutDeciderRemise ? "À décider avant la validation." : "En attente de la décision du DG : la validation est bloquée jusque-là."}</span>
          <Button size="sm" variant="secondary" onClick={() => setCommentaires(true)}><BadgePercent size={14} /> {peutDeciderRemise ? "Traiter" : "Voir"}</Button>
        </div>
      )}

      {aReferencer > 0 && c.statut === "en_attente" && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-ge7-gold/50 bg-ge7-gold-soft/40 px-4 py-3 text-sm">
          <span className="flex items-center gap-2">
            <PackageSearch size={16} className="shrink-0 text-ge7-bronze" />
            <span><strong>{aReferencer} produit(s) demandé(s) hors catalogue.</strong> Approvisionnez-les, créez-les dans Produits si besoin, puis associez chaque ligne à un produit avant de valider.</span>
          </span>
          <Link to="/admin/produits" className="text-sm font-semibold text-ge7-purple hover:underline">Produits</Link>
        </div>
      )}

      {prixASaisir > 0 && c.statut === "en_attente" && (
        <div className="mb-4 rounded-2xl border border-ge7-gold/50 bg-ge7-gold-soft/40 px-4 py-3 text-sm">
          <strong>{prixASaisir} prix à saisir.</strong> Aucun prix de la ville de livraison pour ces produits : cliquez sur « Saisir le prix » sur chaque ligne avant de valider.
        </div>
      )}

      {stockInsuffisant && (
        <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          Stock insuffisant pour au moins une ligne : la validation est bloquée tant que le stock n'est pas réapprovisionné.
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-6">
          <Card padded={false} className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-ge7-black text-left text-xs uppercase tracking-wider text-ge7-gold-light">
                <tr>
                  <th className="px-5 py-3">Désignation</th>
                  <th className="px-5 py-3 text-right">Qté</th>
                  <th className="px-5 py-3 text-right">PU (figé)</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-right">Stock dispo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ge7-black/5">
                {c.lignes.map((l) => {
                  const inconnu = l.produit_id === null;
                  const insuffisant = !inconnu && l.stock_disponible < l.quantite && c.statut === "en_attente";
                  return (
                    <tr key={l.id} className={inconnu ? "bg-ge7-gold-soft/30" : undefined}>
                      <td className="px-5 py-3">
                        <p className="font-semibold">{l.designation}</p>
                        {inconnu && <Badge tone="amber">hors catalogue · à référencer</Badge>}
                        {l.precision && <p className="text-xs text-ge7-black/50">{l.precision}</p>}
                      </td>
                      <td className="px-5 py-3 text-right">{l.quantite} {l.unite ?? ""}</td>
                      <td className="px-5 py-3 text-right">
                        {l.prix_unitaire > 0 ? money(l.prix_unitaire) : <Badge tone="amber">à saisir</Badge>}
                        {peutGerer && c.statut === "en_attente" && (
                          <button
                            type="button"
                            onClick={() => setLigneEdit({ id: l.id, designation: l.designation, precision: l.precision, inconnu, produit_id: l.produit_id ? String(l.produit_id) : "", prix: l.prix_unitaire > 0 ? String(l.prix_unitaire) : "", filtre: inconnu ? l.designation : "" })}
                            className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-ge7-purple hover:underline"
                          >
                            <Pencil size={12} /> {inconnu ? "Référencer" : l.prix_unitaire > 0 ? "Modifier" : "Saisir le prix"}
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold">{money(l.total_ligne)}</td>
                      <td className={`px-5 py-3 text-right ${insuffisant ? "font-bold text-rose-600" : "text-ge7-black/60"}`}>{inconnu ? "" : l.stock_disponible}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-ge7-cream text-sm">
                {c.remise.montant > 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 pt-3 text-right text-ge7-black/60">Sous-total {money(c.sous_total)} · Remise {c.remise.taux} %</td>
                    <td className="px-5 pt-3 text-right font-semibold text-emerald-700">− {money(c.remise.montant)}</td>
                    <td />
                  </tr>
                )}
                <tr><td colSpan={3} className="px-5 py-3 text-right font-bold">TOTAL</td><td className="px-5 py-3 text-right text-lg font-extrabold text-ge7-bronze">{money(c.total)}</td><td /></tr>
              </tfoot>
            </table>
          </Card>
          {c.note && <Card><CardHeader title="Note du client" /><p className="text-sm">{c.note}</p></Card>}

          {c.statut === "en_livraison" && (
            <Card padded={false}>
              <div className="px-5 pt-4"><CardHeader title="Suivi de la livraison" /></div>
              {(() => {
                const lat = c.livraison?.latitude ?? (estChauffeur ? maPosition?.latitude : null);
                const lng = c.livraison?.longitude ?? (estChauffeur ? maPosition?.longitude : null);
                return lat != null && lng != null ? (
                  <CommandeMap latitude={lat} longitude={lng} majLe={c.livraison?.position_le} label={estChauffeur ? "Ma position" : "Position du chauffeur"} />
                ) : (
                  <p className="px-5 pb-4 text-sm text-ge7-black/50">
                    {estChauffeur ? "Recherche de votre position GPS… (autorisez la géolocalisation)" : "En attente de la position du chauffeur…"}
                  </p>
                );
              })()}
            </Card>
          )}
          <Card>
            <CardHeader title="Historique" />
            <ol className="relative ml-2 space-y-4 border-l border-ge7-black/10 pl-5">
              {c.historique.map((h, i) => (
                <li key={i} className="text-sm">
                  <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-ge7-gold" />
                  <p className="font-semibold">{h.nouveau_statut_libelle}</p>
                  <p className="text-xs text-ge7-black/50">{datetime(h.created_at)} · {h.user}{h.commentaire ? ` ${h.commentaire}` : ""}</p>
                </li>
              ))}
            </ol>
          </Card>
          
        </div>

        <div className="w-full shrink-0 space-y-6 lg:w-80 xl:w-96">
          <Card>
            <CardHeader title="Client & livraison" />
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-ge7-black/50">Client</dt><dd className="font-semibold">{c.client.nom}</dd></div>
              <div><dt className="text-xs text-ge7-black/50">Téléphone</dt><dd>{c.client.telephone}</dd></div>
              <div><dt className="text-xs text-ge7-black/50">Adresse</dt><dd>{c.adresse.ville} {c.adresse.quartier}<br /><span className="text-ge7-black/60">{c.adresse.point_repere}</span></dd></div>
              <div><dt className="text-xs text-ge7-black/50">Paiement</dt><dd>À la livraison <strong>{money(c.total)}</strong></dd></div>
              {c.chauffeur && <div><dt className="text-xs text-ge7-black/50">Chauffeur</dt><dd className="font-semibold">{c.chauffeur.nom}</dd></div>}
              {c.valideur && <div><dt className="text-xs text-ge7-black/50">Validée par</dt><dd>{c.valideur} le {datetime(c.validee_le)}</dd></div>}
            </dl>
          </Card>

          {c.facture && (
            <Card>
              <CardHeader title="Facture" />
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between"><dt className="font-semibold">{c.facture.numero}</dt><StatusBadge status={c.facture.statut_paiement} /></div>
                <div className="flex justify-between"><dt className="text-ge7-black/60">Montant</dt><dd className="font-semibold">{money(c.facture.montant_total)}</dd></div>
                <div className="flex justify-between"><dt className="text-ge7-black/60">Encaissé</dt><dd>{money(c.facture.encaisse)}</dd></div>
                {c.facture.statut_paiement === "partiellement_payee" && (
                  <div className="flex justify-between"><dt className="text-ge7-black/60">Reste à payer</dt><dd className="font-bold text-amber-700">{money(c.facture.montant_total - c.facture.encaisse)}</dd></div>
                )}
                {c.facture.avoir && (
                  <div className="flex justify-between"><dt className="text-ge7-black/60">Avoir</dt><dd>{c.facture.avoir.numero} · {money(c.facture.avoir.montant)}</dd></div>
                )}
              </dl>
            </Card>
          )}

          {c.livraison && (
            <Card>
              <CardHeader title="Livraison" />
              <dl className="space-y-2 text-sm">
                {c.livraison.depart_le && <div><dt className="text-xs text-ge7-black/50">Départ</dt><dd>{datetime(c.livraison.depart_le)}</dd></div>}
                {c.livraison.livree_le && <div><dt className="text-xs text-ge7-black/50">Livrée le</dt><dd>{datetime(c.livraison.livree_le)}</dd></div>}
                {c.livraison.receptionnaire && <div><dt className="text-xs text-ge7-black/50">Réceptionnaire</dt><dd className="font-semibold">{c.livraison.receptionnaire}</dd></div>}
                {c.livraison.signature && (
                  <div>
                    <dt className="text-xs text-ge7-black/50">Signature du réceptionnaire</dt>
                    <dd>
                      <a href={c.livraison.signature} target="_blank" rel="noreferrer" title="Ouvrir en plein écran">
                        <img src={c.livraison.signature} alt="Signature du réceptionnaire" className="mt-1 h-32 w-full rounded-lg border border-ge7-black/10 bg-white object-contain transition hover:border-ge7-gold" />
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </Card>
          )}

          <Card>
            <CardHeader title="Progression" />
            <ol className="space-y-1.5 text-xs">
              {FRISE.map((e, i, arr) => {
                const idx = arr.findIndex((s) => s.statut === c.statut);
                const done = idx >= 0 ? idx >= i : false;
                return (
                  <li key={e.statut} className={`flex items-center gap-2 ${done ? "text-ge7-black" : "text-ge7-black/35"}`}>
                    <span className={`size-2 rounded-full ${done ? "bg-ge7-gold" : "bg-ge7-black/15"}`} />
                    {e.label}
                    {c.statut === e.statut && <Badge tone="gold" className="ml-auto">actuel</Badge>}
                  </li>
                );
              })}
              {["refusee", "annulee", "echec_livraison"].includes(c.statut) && (
                <li className="flex items-center gap-2 text-rose-600">
                  <span className="size-2 rounded-full bg-rose-500" />
                  {c.statut_libelle}
                </li>
              )}
            </ol>
          </Card>
        </div>
      </div>

      {commentaires && (
        <Modal
          title={`Commentaires  ${c.numero}`}
          subtitle="Annotations du client et de l'équipe, remise et données complètes de la commande."
          size="lg"
          onClose={() => setCommentaires(false)}
          footer={<Button variant="secondary" onClick={() => setCommentaires(false)}>Fermer</Button>}
        >
          <div className="space-y-5 text-sm">
            <section className="grid gap-3 sm:grid-cols-3">
              <div><p className="text-xs text-ge7-black/50">Client</p><p className="font-semibold">{c.client.nom}</p><p>{c.client.telephone}</p></div>
              <div><p className="text-xs text-ge7-black/50">Livraison</p><p>{c.adresse.ville} {c.adresse.quartier}</p><p className="text-ge7-black/60">{c.adresse.point_repere}</p></div>
              <div>
                <p className="text-xs text-ge7-black/50">Provenance</p>
                <p className="font-semibold">{c.compte_client ? "Espace client" : "Boutique publique"}</p>
                {c.compte_client && <p className="text-ge7-black/60">{c.compte_client.nom} · code {c.compte_client.code}</p>}
              </div>
            </section>

            <section className="rounded-xl border border-ge7-black/10 p-3">
              <div className="flex flex-wrap justify-between gap-2">
                <span><StatusBadge status={c.statut} /> <span className="ml-1 text-ge7-black/60">reçue le {datetime(c.cree_le)}</span></span>
                <span>{c.lignes.length} ligne(s) · <strong>{money(c.total)}</strong>{c.remise.montant > 0 && <span className="text-ge7-black/50"> (brut {money(c.sous_total)})</span>}</span>
              </div>
              <ul className="mt-2 space-y-0.5 text-xs text-ge7-black/70">
                {c.lignes.map((l) => <li key={l.id}>{l.quantite} {l.unite ?? ""} × {l.designation} : {money(l.total_ligne)}</li>)}
              </ul>
              {(c.extras?.length ?? 0) > 0 && <p className="mt-2 text-xs text-ge7-black/60">Frais annexes : {c.extras!.map((x) => `${x.label} ${money(x.amount)}`).join(" · ")}</p>}
              {c.note && <p className="mt-2 rounded-lg bg-ge7-cream px-2.5 py-1.5 text-xs"><strong>Note de livraison :</strong> {c.note}</p>}
              {c.motif && <p className="mt-2 text-xs font-medium text-rose-700">Motif : {c.motif}</p>}
            </section>

            <section>
              <h4 className="mb-2 flex items-center gap-2 font-bold"><BadgePercent size={15} className="text-ge7-bronze" /> Remise</h4>
              {!c.remise.statut && <p className="text-ge7-black/50">Aucune remise demandée.</p>}
              {c.remise.statut === "demandee" && (
                <p>Demandée : <strong>{c.remise.taux_demande} %</strong> (≈ {money(Math.round((c.sous_total * (c.remise.taux_demande ?? 0)) / 100))}){c.remise.motif ? ` (« ${c.remise.motif} »)` : ""}</p>
              )}
              {c.remise.statut === "accordee" && <p className="text-emerald-700">Accordée : <strong>{c.remise.taux} %</strong> soit − {money(c.remise.montant)}{c.remise.taux_demande ? ` (demandé : ${c.remise.taux_demande} %)` : ""}</p>}
              {c.remise.statut === "refusee" && <p className="text-rose-700">Refusée{c.remise.taux_demande ? ` (demandé : ${c.remise.taux_demande} %)` : ""}.</p>}
              {peutDeciderRemise && c.statut === "en_attente" && c.remise.statut === "demandee" && (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <Input label="Taux accordé (%)" type="number" min={0.5} max={100} step="0.5" value={tauxRemise ?? String(c.remise.taux_demande ?? c.remise.taux ?? "")} onChange={(e) => setTauxRemise(e.target.value)} className="w-40" />
                  <Button size="sm" loading={decision.isPending} disabled={!(Number(tauxRemise ?? c.remise.taux_demande) > 0)} onClick={() => decision.mutate({ decision: "accorder", taux: Number(tauxRemise ?? c.remise.taux_demande) })}><Check size={14} /> Accorder</Button>
                  <Button size="sm" variant="danger" loading={decision.isPending} onClick={() => decision.mutate({ decision: "refuser" })}><X size={14} /> Refuser</Button>
                </div>
              )}
            </section>

            <section>
              <h4 className="mb-2 flex items-center gap-2 font-bold"><MessageSquareText size={15} className="text-ge7-bronze" /> Annotations</h4>
              <AnnotationsFil
                annotations={c.annotations ?? []}
                moi="equipe"
                onEnvoyer={(contenu) => annoter.mutateAsync({ contenu })}
                envoi={annoter.isPending}
                placeholder={c.compte_client ? "Répondre au client (visible dans son espace)…" : "Ajouter une annotation interne…"}
              />
            </section>

            <section>
              <h4 className="mb-2 font-bold">Historique</h4>
              <ol className="space-y-1.5 text-xs">
                {c.historique.map((h, i) => (
                  <li key={i}><span className="font-semibold">{datetime(h.created_at)}</span> · {h.nouveau_statut_libelle} · {h.user}{h.commentaire ? ` · ${h.commentaire}` : ""}</li>
                ))}
              </ol>
            </section>
          </div>
        </Modal>
      )}

      {motif && (
        <Modal
          title={motif.action === "refuser" ? "Refuser la commande" : motif.action === "annuler" ? "Annuler la commande" : "Échec de livraison"}
          subtitle={motif.action === "annuler" && c.facture ? "Un avoir sera créé et le stock remis. La facture est conservée." : undefined}
          size="sm"
          onClose={() => setMotif(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setMotif(null)}>Fermer</Button>
              <Button variant="danger" loading={actionMotif.isPending} disabled={motif.valeur.trim().length < 3} onClick={() => actionMotif.mutateAsync(motif).then(() => setMotif(null)).catch(() => {})}>Confirmer</Button>
            </>
          }
        >
          <Textarea label="Motif (obligatoire)" required value={motif.valeur} onChange={(e) => setMotif({ ...motif, valeur: e.target.value })} />
        </Modal>
      )}

      {ligneEdit && (() => {
        const filtre = ligneEdit.filtre.trim().toLowerCase();
        const options = (produits ?? []).filter((p) => !filtre || `${p.name} ${p.type ?? ""} ${p.reference}`.toLowerCase().includes(filtre)).slice(0, 50);
        return (
          <Modal
            title={ligneEdit.inconnu ? "Référencer le produit demandé" : "Modifier la ligne"}
            subtitle={ligneEdit.inconnu ? `Demande du client : « ${ligneEdit.designation} »${ligneEdit.precision ? ` (${ligneEdit.precision})` : ""}` : ligneEdit.designation}
            size="sm"
            onClose={() => setLigneEdit(null)}
            footer={
              <>
                <Button variant="secondary" onClick={() => setLigneEdit(null)}>Annuler</Button>
                <Button
                  loading={modifierLigne.isPending}
                  disabled={ligneEdit.inconnu ? !ligneEdit.produit_id : !(Number(ligneEdit.prix) > 0)}
                  onClick={() =>
                    modifierLigne
                      .mutateAsync({
                        ligne: ligneEdit.id,
                        // Produit du catalogue : figé, seul le prix se modifie.
                        produit_id: ligneEdit.inconnu && ligneEdit.produit_id ? Number(ligneEdit.produit_id) : undefined,
                        prix_unitaire: ligneEdit.prix !== "" ? Number(ligneEdit.prix) : undefined,
                      })
                      .then(() => setLigneEdit(null))
                      .catch(() => {})
                  }
                >
                  Enregistrer
                </Button>
              </>
            }
          >
            {ligneEdit.inconnu ? (
              <>
                {/* Produit demandé hors catalogue : on l'associe à un produit existant. */}
                <Input label="Rechercher un produit du catalogue" value={ligneEdit.filtre} onChange={(e) => setLigneEdit({ ...ligneEdit, filtre: e.target.value })} />
                <Select label="Produit" required value={ligneEdit.produit_id} onChange={(e) => setLigneEdit({ ...ligneEdit, produit_id: e.target.value })} className="mt-3">
                  <option value="">Choisir le produit…</option>
                  {options.map((p) => <option key={p.id} value={p.id}>{p.name}{p.type ? ` · ${p.type}` : ""} ({p.reference})</option>)}
                </Select>
                <p className="mt-1 text-xs text-ge7-black/50">Produit absent ? Créez-le d'abord dans <Link to="/admin/produits" className="font-semibold text-ge7-purple hover:underline">Produits</Link>, puis revenez ici.</p>
              </>
            ) : (
              // Produit déjà au catalogue : choisi par le client, non modifiable.
              <div>
                <p className="mb-1 text-xs font-semibold text-ge7-black/60">Produit</p>
                <p className="rounded-xl border border-ge7-black/10 bg-ge7-black/[0.04] px-3.5 py-2.5 text-sm font-semibold">{ligneEdit.designation}</p>
              </div>
            )}
            <Input
              label="Prix unitaire (FCFA)"
              type="number"
              min={0}
              value={ligneEdit.prix}
              onChange={(e) => setLigneEdit({ ...ligneEdit, prix: e.target.value })}
              hint="Vide : prix du barème de la ville de livraison (vide si la commande n'a pas de ville tarifaire)."
              className="mt-3"
            />
          </Modal>
        );
      })()}

      {/* [CHAUFFEUR] Fenêtre d'affectation du chauffeur (voir CHAUFFEUR.md).
      {expedier && (
        <Modal
          title="Affecter un chauffeur"
          subtitle="Le chauffeur verra la commande dans son espace et démarrera la livraison."
          size="sm"
          onClose={() => setExpedier(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setExpedier(null)}>Annuler</Button>
              <Button variant="purple" loading={doAffecter.isPending} disabled={!expedier.chauffeur_id} onClick={() => doAffecter.mutateAsync(expedier).then(() => setExpedier(null)).catch(() => {})}>Affecter</Button>
            </>
          }
        >
          <Select label="Chauffeur" required value={String(expedier.chauffeur_id ?? "")} onChange={(e) => setExpedier({ chauffeur_id: Number(e.target.value) })}>
            <option value=""></option>
            {chauffeurs?.map((ch) => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
          </Select>
          {errChauffeurs && (
            <p className="mt-2 text-xs font-medium text-red-600">
              Impossible de charger la liste des chauffeurs (accès refusé ou API indisponible).{" "}
              <button type="button" className="underline" onClick={() => void refetchChauffeurs()}>Réessayer</button>
            </p>
          )}
          {chauffeurs?.length === 0 && <p className="mt-2 text-xs text-amber-700">Aucun chauffeur disponible. Créez-en un dans Logistique → Chauffeurs.</p>}
        </Modal>
      )}
      */}

      {/* [CHAUFFEUR] Fenêtre de livraison : réceptionnaire, encaissement et signature (voir CHAUFFEUR.md).
      {livrer && (
        <Modal
          title="Confirmer la livraison"
          subtitle="Encaissement et signature du réceptionnaire."
          size="lg"
          onClose={() => setLivrer(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setLivrer(null)}>Annuler</Button>
              <Button loading={doLivrer.isPending} disabled={livrer.receptionnaire.trim().length < 2 || !livrer.montant} onClick={confirmerLivraison}><PackageCheck size={16} /> Enregistrer la livraison</Button>
            </>
          }
        >
          <FormGrid cols={3}>
            <Input label="Réceptionnaire" required value={livrer.receptionnaire} onChange={(e) => setLivrer({ ...livrer, receptionnaire: e.target.value })} />
            <Input label="Montant encaissé (FCFA)" required type="number" min={0} value={livrer.montant} onChange={(e) => setLivrer({ ...livrer, montant: e.target.value })} />
            <Select label="Mode de paiement" required value={livrer.mode} onChange={(e) => setLivrer({ ...livrer, mode: e.target.value })}>
              <option value="ESPECES">Espèces</option>
              <option value="AIRTEL_MONEY">Airtel Money</option>
              <option value="MOOV_MONEY">Moov Money</option>
            </Select>
          </FormGrid>
          {c.facture && Number(livrer.montant) < c.facture.montant_total && (
            <p className="mt-2 text-xs font-medium text-amber-700">
              Encaissement partiel : il restera {money(c.facture.montant_total - Number(livrer.montant || 0))} à payer.
            </p>
          )}
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-ge7-black/60">Signature du client</span>
              <button type="button" className="inline-flex items-center gap-1 text-xs text-ge7-purple hover:underline" onClick={() => signature.current?.clear()}><RotateCcw size={12} /> Effacer</button>
            </div>
            <SignaturePad ref={signature} />
          </div>
        </Modal>
      )}
      */}
    </>
  );
}
