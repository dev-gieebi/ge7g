import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  Check,
  ClipboardList,
  FileDown,
  MapPin,
  PackageCheck,
  Printer,
  RotateCcw,
  Truck,
  TriangleAlert,
  X,
} from "lucide-react";
import type { CommandeDetail, PosSale } from "@/types";
import { useAction, useOne } from "@/lib/hooks";
import { useChauffeurs } from "@/features/shared/refData";
import { api } from "@/lib/api";
import { datetime, money } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { Badge, Button, Card, CardHeader, ErrorState, FormGrid, Input, Loading, Modal, PageHeader, Select, StatusBadge, Textarea } from "@/components/ui";
import { SignaturePad, type SignaturePadRef } from "./SignaturePad";
import { Facture } from "@/features/pos/Facture";
import { CommandeMap } from "./CommandeMap";
import { FRISE } from "./statuts";

const KEYS = ["commande", "commandes", "commande-stats"];

type MotifAction = "refuser" | "annuler" | "echec";

/**
 * Document A4 (facture ou bon de livraison) de la commande, au même modèle
 * que l'achat en caisse — `PosSale` minimal reconstruit depuis la commande.
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
    subtotal: montant,
    discount_rate: 0,
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
  const peutGerer = hasRole(user, "LG_ADMIN", "DG_ADMIN");
  const peutAffecter = hasRole(user, "LG_ADMIN", "DG_ADMIN", "CDG_ADMIN");
  const estChauffeur = user?.role === "CHAUFFEUR";
  const peutLivrer = hasRole(user, "LG_ADMIN", "DG_ADMIN", "CHAUFFEUR");

  // Pendant la livraison, la carte suit la position du chauffeur (15 s).
  const commande = useOne<CommandeDetail>("commande", id ? `/commandes/${id}` : null, 15_000);
  const { data: chauffeurs, isError: errChauffeurs, refetch: refetchChauffeurs } = useChauffeurs(!estChauffeur);

  const [motif, setMotif] = useState<{ action: MotifAction; valeur: string } | null>(null);
  const [expedier, setExpedier] = useState<{ chauffeur_id?: number } | null>(null);
  const [livrer, setLivrer] = useState<{ receptionnaire: string; montant: string; mode: string } | null>(null);
  const [impression, setImpression] = useState<"facture" | "bl" | null>(null);
  const [solde, setSolde] = useState(false);
  // Position locale du chauffeur (même source que le partage GPS) : la carte
  // s'affiche pour lui dès le départ, sans attendre le retour du serveur.
  const [maPosition, setMaPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const signature = useRef<SignaturePadRef>(null);

  const valider = useAction(() => `/commandes/${id}/valider`, { keys: KEYS, success: "Commande validée facture et vente créées" });
  const preparer = useAction(() => `/commandes/${id}/preparer`, { keys: KEYS, success: "Commande passée en préparation" });
  const actionMotif = useAction<{ action: MotifAction; valeur: string }>(
    (v) => `/commandes/${id}/${v.action}`,
    { keys: KEYS, success: "Statut mis à jour", body: (v) => ({ motif: v.valeur }) },
  );
  const doAffecter = useAction<{ chauffeur_id?: number }>(() => `/commandes/${id}/affecter`, { keys: KEYS, success: "Chauffeur affecté à la commande", body: (v) => v });
  const doDemarrer = useAction<{ latitude?: number; longitude?: number }>(() => `/commandes/${id}/demarrer`, { keys: KEYS, success: "Mission démarrée bonne route !", body: (v) => v });
  const doLivrer = useAction<{ receptionnaire: string; montant: string; mode: string; signature?: string | null }>(
    () => `/commandes/${id}/livrer`,
    { keys: KEYS, success: "Livraison enregistrée", body: (v) => v },
  );

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

  /** Départ de la mission : position GPS réelle récupérée au clic. */
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

  const stockInsuffisant = c.statut === "en_attente" && c.lignes.some((l) => l.stock_disponible < l.quantite);
  // Le bon de livraison accompagne la commande dès sa validation.
  const imprimable = ["validee", "en_preparation", "en_livraison", "livree"].includes(c.statut);

  const confirmerLivraison = () => {
    if (!livrer) return;
    doLivrer
      .mutateAsync({ ...livrer, montant: livrer.montant, signature: signature.current?.dataUrl() ?? null })
      .then(() => setLivrer(null))
      .catch(() => {});
  };

  // Aperçu d'impression : même modèle A4 que la facture d'achat caisse,
  // avec la mention « Commande en ligne » pour distinguer la provenance.
  if (impression) {
    const estBl = impression === "bl";
    const sale = saleDepuisCommande(c, estBl ? c.numero : (c.facture?.numero ?? c.numero));

    return (
      <>
        <div className="no-print mb-4 flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setImpression(null)}><ArrowLeft size={16} /> Retour</Button>
          {!estBl && (
            <Button variant={solde ? "secondary" : "purple"} onClick={() => setSolde(!solde)}><BadgeCheck size={16} /> Soldé</Button>
          )}
          <Button onClick={() => window.print()}><Printer size={16} /> Imprimer / PDF</Button>
        </div>
        <Facture sale={sale} originLabel={`Commande en ligne : ${c.numero}`} docTitle={estBl ? "BON DE LIVRAISON" : "FACTURE"} solde={solde} />
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
              <Button variant="secondary" onClick={() => setImpression("bl")}><Printer size={16} /> Bon de livraison</Button>
            )}
            {c.facture && (
              <Button variant="secondary" onClick={() => setImpression("facture")}><FileDown size={16} /> Facture PDF</Button>
            )}
            {peutGerer && c.statut === "en_attente" && (
              <>
                <Button variant="danger" onClick={() => setMotif({ action: "refuser", valeur: "" })}><X size={16} /> Refuser</Button>
                <Button onClick={() => valider.mutate()} loading={valider.isPending}><Check size={16} /> Valider</Button>
              </>
            )}
            {peutGerer && c.statut === "validee" && (
              <>
                <Button variant="danger" onClick={() => setMotif({ action: "annuler", valeur: "" })}><Ban size={16} /> Annuler</Button>
                <Button variant="purple" onClick={() => preparer.mutate()} loading={preparer.isPending}><ClipboardList size={16} /> Passer en préparation</Button>
              </>
            )}
            {peutAffecter && ["validee", "en_preparation", "echec_livraison"].includes(c.statut) && (
              <Button variant="purple" onClick={() => { setExpedier({}); void refetchChauffeurs(); }}><Truck size={16} /> {c.chauffeur ? "Réaffecter" : "Affecter un chauffeur"}</Button>
            )}
            {estChauffeur && c.chauffeur?.id === user?.id && ["validee", "en_preparation", "echec_livraison"].includes(c.statut) && (
              <Button onClick={demarrerMission} loading={doDemarrer.isPending}><MapPin size={16} /> Démarrer la mission</Button>
            )}
            {peutGerer && (c.statut === "en_preparation" || c.statut === "echec_livraison") && (
              <Button variant="danger" onClick={() => setMotif({ action: "annuler", valeur: "" })}><Ban size={16} /> Annuler</Button>
            )}
            {peutLivrer && c.statut === "en_livraison" && (
              <>
                <Button variant="danger" onClick={() => setMotif({ action: "echec", valeur: "" })}><TriangleAlert size={16} /> Échec de livraison</Button>
                <Button onClick={() => setLivrer({ receptionnaire: "", montant: String(c.facture?.montant_total ?? c.total), mode: "ESPECES" })}><PackageCheck size={16} /> Confirmer la livraison</Button>
              </>
            )}
          </>
        }
      />

      {stockInsuffisant && (
        <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          Stock insuffisant pour au moins une ligne, la validation sera refusée tant que le stock n'est pas réapprovisionné.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card padded={false}>
            <table className="w-full text-sm">
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
                  const insuffisant = l.stock_disponible < l.quantite && c.statut === "en_attente";
                  return (
                    <tr key={l.id}>
                      <td className="px-5 py-3 font-semibold">{l.designation}</td>
                      <td className="px-5 py-3 text-right">{l.quantite} {l.unite ?? ""}</td>
                      <td className="px-5 py-3 text-right">{money(l.prix_unitaire)}</td>
                      <td className="px-5 py-3 text-right font-semibold">{money(l.total_ligne)}</td>
                      <td className={`px-5 py-3 text-right ${insuffisant ? "font-bold text-rose-600" : "text-ge7-black/60"}`}>{l.stock_disponible}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-ge7-cream text-sm">
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

        <div className="space-y-6">
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
    </>
  );
}
