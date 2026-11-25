import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Printer, Send, CheckCircle2, Trash2, X, XCircle } from "lucide-react";
import type { Quote, QuoteStatus } from "@/types";
import { useAction, useOne } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import { useConfirmer } from "@/lib/confirmation";
import { money, qty } from "@/lib/format";
import { hasRole } from "@/lib/rbac";
import { Button, Card, ErrorState, Loading, PageHeader, StatusBadge } from "@/components/ui";
import { Devis } from "./Devis";
import { numeroProforma } from "./numero";
import { AjoutProduitsModal, type LigneAjout } from "@/features/shared/AjoutProduitsModal";

export function QuoteDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const quote = useOne<Quote>("quote", id ? `/quotes/${id}` : null);
  // Validation / annulation : décision interne (procédure §8).
  const canChangeStatus = hasRole(user, "LG_ADMIN", "DG_ADMIN");
  const canEdit = hasRole(user, "LG_ADMIN", "DG_ADMIN", "CDG_ADMIN");
  // Frais annexes (manutention, livraison…) enregistrés sur la proforma.
  const [extras, setExtras] = useState<{ label: string; amount: number }[]>([]);
  // Ajout de produits : seulement tant que la proforma n'est pas validée.
  const [ajout, setAjout] = useState(false);

  useEffect(() => {
    if (quote.data?.extras) {
      setExtras(quote.data.extras);
    }
  }, [quote.data?.id, quote.data?.extras]);

  const setStatus = useAction<{ status: QuoteStatus }, Quote>(
    () => `/quotes/${id}/status`,
    { keys: ["quote", "quotes"], success: "Statut mis à jour", body: (v) => v },
  );

  const saveExtras = useAction<{ extras: { label: string; amount: number }[] }, Quote>(
    () => `/quotes/${id}/extras`,
    { keys: ["quote", "quotes"], success: "Frais annexes enregistrés", body: (v) => v },
  );

  const ajouterProduits = useAction<{ items: LigneAjout[] }, Quote>(
    () => `/quotes/${id}/items`,
    { keys: ["quote", "quotes"], success: "Produits ajoutés à la proforma", body: (v) => v },
  );

  // Produit ajouté par erreur : retiré tant que la proforma n'est pas validée.
  const retirerProduit = useAction<number, void>(
    (itemId) => `/quotes/${id}/items/${itemId}`,
    { method: "delete", keys: ["quote", "quotes"], success: "Produit retiré de la proforma" },
  );
  const confirmer = useConfirmer();

  if (quote.isLoading) return <Loading />;
  if (!quote.data) return <ErrorState message="Proforma introuvable" />;
  const q = quote.data;

  return (
    <>
      <div className="no-print">
        <PageHeader
          breadcrumb={
            <Link to="/admin/devis" className="inline-flex items-center gap-1 hover:underline">
              <ArrowLeft size={12} /> Proforma
            </Link>
          }
          title={numeroProforma(q.number)}
          subtitle={<StatusBadge status={q.status} />}
          action={
            <>
              {canEdit && q.status === "BROUILLON" && (
                <Button variant="secondary" onClick={() => setAjout(true)}><Plus size={15} /> Ajouter des produits</Button>
              )}
              {/* Ordre imposé : d'abord valider, ensuite envoyer. */}
              {canChangeStatus && q.status === "BROUILLON" && (
                <Button variant="dark" loading={setStatus.isPending} onClick={() => setStatus.mutate({ status: "VALIDE" })}>
                  <CheckCircle2 size={15} /> Valider
                </Button>
              )}
              {canChangeStatus && q.status === "VALIDE" && (
                <Button variant="purple" loading={setStatus.isPending} onClick={() => setStatus.mutate({ status: "ENVOYE" })}>
                  <Send size={15} /> Envoyer
                </Button>
              )}
              {/* Annuler : seulement sur un brouillon ; validée ou envoyée, la proforma ne s'annule plus. */}
              {canChangeStatus && q.status === "BROUILLON" && (
                <Button
                  variant="secondary"
                  loading={setStatus.isPending}
                  onClick={async () => {
                    if (await confirmer({ titre: "Annuler la proforma ?", message: <>Voulez-vous vraiment annuler la proforma <b>{numeroProforma(q.number)}</b> ?</>, bouton: "Annuler la proforma" })) setStatus.mutate({ status: "ANNULE" });
                  }}
                >
                  <XCircle size={15} /> Annuler
                </Button>
              )}
              {/* Impression seulement une fois la proforma validée (validée ou envoyée). */}
              {(q.status === "VALIDE" || q.status === "ENVOYE") && <Button onClick={() => window.print()}><Printer size={15} /> Imprimer</Button>}
            </>
          }
        />
      </div>
      {/* Produits de la proforma : retrait d'un produit ajouté par erreur, tant qu'elle n'est pas validée. */}
      {canEdit && q.status === "BROUILLON" && (q.items ?? []).length > 0 && (
        <Card className="no-print mx-auto mb-4 max-w-3xl" padded>
          <h3 className="text-sm font-extrabold text-ge7-black/80">Produits de la proforma</h3>
          <p className="text-xs text-ge7-black/50">Un produit ajouté par erreur peut être retiré ; le total est recalculé.</p>
          <ul className="mt-3 divide-y divide-ge7-black/5">
            {(q.items ?? []).map((it) => (
              <li key={it.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-semibold">{it.product?.name}{it.product?.type ? ` · ${it.product.type}` : ""}</span>
                <span className="shrink-0 text-xs text-ge7-black/60">{qty(Number(it.quantity), it.product?.unit?.symbol)} × {money(it.unit_price)}</span>
                <span className="w-28 shrink-0 text-right font-bold">{money(it.total)}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  title="Retirer ce produit de la proforma"
                  loading={retirerProduit.isPending && retirerProduit.variables === it.id}
                  onClick={async () => {
                    if ((q.items ?? []).length <= 1) {
                      await confirmer({ titre: "Impossible de retirer", message: "C'est le dernier produit de la proforma : il ne peut pas être retiré.", seulementOk: true });
                      return;
                    }
                    if (await confirmer({ titre: "Retirer le produit ?", message: <>Voulez-vous vraiment retirer <b>« {it.product?.name} »</b> de la proforma ? Le total sera recalculé.</>, bouton: "Retirer" })) retirerProduit.mutate(it.id);
                  }}
                >
                  <Trash2 size={14} className="text-rose-600" />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {/* Frais annexes : modifiables seulement tant que la proforma est en brouillon. */}
      {canEdit && q.status === "BROUILLON" && (
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
      {/* Proforma non validée : visible à l'écran, mais l'impression (même Ctrl+P) ne sort qu'un avertissement. */}
      {q.status === "VALIDE" || q.status === "ENVOYE" ? (
        <Devis quote={{ ...q, extras }} />
      ) : (
        <>
          <div className="print:hidden">
            <Devis quote={{ ...q, extras }} />
          </div>
          <p className="hidden p-10 text-center text-lg font-bold print:block">
            Proforma {numeroProforma(q.number)} non validée : impression impossible.
          </p>
        </>
      )}
      <div className="no-print mt-6 text-center"><Link to="/admin/devis"><Button variant="purple">Retour aux proformas</Button></Link></div>
      {ajout && (
        <AjoutProduitsModal
          titre={`Ajouter des produits à ${numeroProforma(q.number)}`}
          zoneId={q.zone_id}
          enCours={ajouterProduits.isPending}
          onClose={() => setAjout(false)}
          onValider={(items) => ajouterProduits.mutateAsync({ items }).then(() => setAjout(false)).catch(() => {})}
        />
      )}
    </>
  );
}
