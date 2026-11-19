import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ClipboardList, MapPin, UserRound } from "lucide-react";
import { fieldErrors } from "@/lib/hooks";
import { shopApi } from "./api";
import { clientApi, useProfilClient } from "./espaceClient";
import { CatalogueClient, ListeDemande, champ, etiquette, fusionner, versPayload, type LigneLocale } from "./DemandeProduits";

const CLE = "ge7.demande";

function charger(): LigneLocale[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CLE) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function enregistrer(lignes: LigneLocale[]) {
  try {
    localStorage.setItem(CLE, JSON.stringify(lignes));
  } catch {
    /* stockage indisponible : la demande reste en mémoire */
  }
}

/**
 * Espace commande du client connecté : tout le catalogue sans prix ni stock,
 * quantités saisies librement, produits hors catalogue, puis adresse de
 * livraison. Nom et téléphone viennent du compte.
 */
export function ClientCommanderPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const profil = useProfilClient();
  const { data: zones } = useQuery({ queryKey: ["shop", "zones"], queryFn: shopApi.zones, staleTime: 5 * 60_000 });

  const [lignes, setLignes] = useState<LigneLocale[]>(charger);
  const [form, setForm] = useState({ ville: "", villeAutre: "", quartier: "", point_repere: "", note: "" });
  const [annotation, setAnnotation] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const zoneCompte = profil.data?.zone ?? null;
  useEffect(() => {
    if (zoneCompte) setForm((f) => ({ ...f, ville: zoneCompte.name }));
  }, [zoneCompte]);

  const majLignes = (next: LigneLocale[]) => {
    setLignes(next);
    enregistrer(next);
  };

  const commander = useMutation({
    mutationFn: clientApi.commander,
    onSuccess: (data) => {
      majLignes([]);
      void qc.invalidateQueries({ queryKey: ["client"] });
      navigate(`/mon-compte/commandes/${data.id}`, { state: { nouvelle: true } });
    },
    onError: (e) => setErrors(fieldErrors(e)),
  });

  const villeFinale = form.ville === "__autre__" ? form.villeAutre.trim() : form.ville;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    commander.mutate({
      nom: profil.data?.nom ?? "",
      telephone: profil.data?.telephone ?? "",
      ville: villeFinale,
      quartier: form.quartier.trim(),
      point_repere: form.point_repere.trim(),
      note: form.note.trim() || undefined,
      zone_id: zones?.find((z) => z.name === form.ville)?.id,
      lignes: versPayload(lignes),
      annotation: annotation.trim() || undefined,
    });
  };

  const err = (k: string) => errors[k]?.[0];
  const erreurLignes = err("lignes") ?? Object.entries(errors).find(([k]) => k.startsWith("lignes."))?.[1]?.[0];

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold">Passer une commande</h1>
      <p className="mt-1 text-sm text-ge7-black/60">
        Choisissez vos produits et saisissez les quantités. Un produit manque ? Demandez-le : notre équipe le recherche pour vous.
        Les prix vous sont communiqués sur la facture, après validation.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <CatalogueClient onAjouter={(l) => majLignes(fusionner(lignes, l))} />

        <form onSubmit={submit} className="h-fit space-y-4 lg:sticky lg:top-24">
          <div className="rounded-2xl border border-ge7-black/10 bg-white p-5">
            <p className="mb-2 flex items-center gap-2 text-sm font-bold"><ClipboardList size={16} className="text-ge7-bronze" /> Ma demande ({lignes.length})</p>
            <ListeDemande
              lignes={lignes}
              onQuantite={(cle, q) => majLignes(lignes.map((l) => (l.cle === cle ? { ...l, quantite: q } : l)))}
              onRetirer={(cle) => majLignes(lignes.filter((l) => l.cle !== cle))}
            />
            {erreurLignes && <p className="mt-2 text-xs font-medium text-rose-600">{erreurLignes}</p>}
          </div>

          <div className="space-y-4 rounded-2xl border border-ge7-black/10 bg-white p-5">
            <p className="text-sm font-bold">Livraison</p>
            <div className="flex items-center gap-3 rounded-xl bg-ge7-cream/70 px-3.5 py-3">
              <UserRound size={18} className="shrink-0 text-ge7-bronze" />
              <div className="text-sm">
                <p className="font-bold">{profil.data?.nom}</p>
                <p className="text-ge7-black/60">{profil.data?.telephone ?? ""}</p>
                {(err("telephone") || err("nom")) && <p className="mt-1 text-xs font-medium text-rose-600">{err("telephone") ?? err("nom")}</p>}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={etiquette}>Ville *</label>
                {zoneCompte ? (
                  <p className={`${champ} bg-ge7-black/[0.04]`}>{zoneCompte.name}</p>
                ) : (
                  <>
                    <select required className={champ} value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })}>
                      <option value="">Choisir…</option>
                      {zones?.map((z) => <option key={z.id} value={z.name}>{z.name}</option>)}
                      <option value="__autre__">Autre ville…</option>
                    </select>
                    {form.ville === "__autre__" && (
                      <input required className={`${champ} mt-2`} value={form.villeAutre} onChange={(e) => setForm({ ...form, villeAutre: e.target.value })} placeholder="Votre ville" />
                    )}
                  </>
                )}
                {err("ville") && <p className="mt-1 text-xs font-medium text-rose-600">{err("ville")}</p>}
              </div>
              <div>
                <label className={etiquette}>Quartier *</label>
                <input required maxLength={100} className={champ} value={form.quartier} onChange={(e) => setForm({ ...form, quartier: e.target.value })} placeholder="Ex. Glass" />
                {err("quartier") && <p className="mt-1 text-xs font-medium text-rose-600">{err("quartier")}</p>}
              </div>
            </div>
            <div>
              <label className={etiquette}>Point de repère *</label>
              <div className="relative">
                <MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ge7-black/40" />
                <input required maxLength={150} className={`${champ} pl-9`} value={form.point_repere} onChange={(e) => setForm({ ...form, point_repere: e.target.value })} placeholder="Ex. Face à la pharmacie du rond-point" />
              </div>
              {err("point_repere") && <p className="mt-1 text-xs font-medium text-rose-600">{err("point_repere")}</p>}
            </div>
            <div>
              <label className={etiquette}>Note de livraison (facultatif)</label>
              <textarea maxLength={500} rows={2} className={champ} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Instructions particulières…" />
            </div>
            <div>
              <label className={etiquette}>Annotation sur la commande (facultatif)</label>
              <textarea maxLength={1000} rows={2} className={champ} value={annotation} onChange={(e) => setAnnotation(e.target.value)} placeholder="Produit équivalent accepté, urgence, conditionnement…" />
              {err("annotation") && <p className="mt-1 text-xs font-medium text-rose-600">{err("annotation")}</p>}
            </div>
          </div>

          {commander.isError && Object.keys(errors).length === 0 && (
            <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">La commande n'a pas pu être enregistrée. Réessayez.</p>
          )}

          <button
            type="submit"
            disabled={commander.isPending || lignes.length === 0}
            className="w-full rounded-full bg-ge7-gold px-5 py-3.5 text-sm font-extrabold uppercase tracking-wide text-ge7-black transition hover:brightness-110 disabled:opacity-50"
          >
            {commander.isPending ? "Envoi en cours…" : "Envoyer ma commande"}
          </button>
        </form>
      </div>
    </div>
  );
}
