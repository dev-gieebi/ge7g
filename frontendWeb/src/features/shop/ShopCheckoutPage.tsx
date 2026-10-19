import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Wallet } from "lucide-react";
import { fieldErrors } from "@/lib/hooks";
import { money } from "@/lib/format";
import { shopApi } from "./api";
import { useCart } from "./cart";

const field = "w-full rounded-xl border border-ge7-black/15 bg-white px-3.5 py-2.5 text-sm focus:border-ge7-gold focus:outline-none";
const label = "mb-1 block text-xs font-bold uppercase tracking-wide text-ge7-black/60";

export function ShopCheckoutPage() {
  const navigate = useNavigate();
  const cart = useCart();
  const { data: zones } = useQuery({ queryKey: ["shop", "zones"], queryFn: shopApi.zones, staleTime: 5 * 60_000 });

  const [form, setForm] = useState({ nom: "", telephone: "", ville: cart.zone?.id ? cart.zone.name : "", villeAutre: "", quartier: "", point_repere: "", note: "", site_web: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const commander = useMutation({
    mutationFn: shopApi.commander,
    onSuccess: (data) => {
      cart.clear();
      navigate(`/commande/confirmation/${data.numero}`, { state: { total: data.total } });
    },
    onError: (e) => setErrors(fieldErrors(e)),
  });

  const villeFinale = form.ville === "__autre__" ? form.villeAutre.trim() : form.ville;
  const zone = zones?.find((z) => z.name === form.ville);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    commander.mutate({
      nom: form.nom.trim(),
      telephone: form.telephone.trim(),
      ville: villeFinale,
      quartier: form.quartier.trim(),
      point_repere: form.point_repere.trim(),
      note: form.note.trim() || undefined,
      zone_id: zone?.id,
      lignes: cart.items.map((i) => ({ produit_id: i.produit_id, quantite: i.quantite })),
      site_web: form.site_web || undefined,
    });
  };

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-display text-2xl font-extrabold">Panier vide</h1>
        <p className="mt-2 text-sm text-ge7-black/60">Ajoutez des produits avant de passer commande.</p>
        <Link to="/produits" className="mt-6 inline-flex rounded-full bg-ge7-gold px-5 py-2.5 text-sm font-bold text-ge7-black">Voir le catalogue</Link>
      </div>
    );
  }

  const err = (k: string) => errors[k]?.[0];

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/panier" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ge7-purple hover:underline">
        <ArrowLeft size={15} /> Panier
      </Link>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Finaliser la commande</h1>
      <p className="mt-1 text-sm text-ge7-black/60">Aucun compte requis vos coordonnées servent uniquement à la livraison.</p>

      <form onSubmit={submit} className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4 rounded-2xl border border-ge7-black/10 bg-white p-5">
          <div>
            <label className={label}>Nom complet *</label>
            <input required minLength={2} maxLength={100} className={field} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Ex. Jean Mba" />
            {err("nom") && <p className="mt-1 text-xs font-medium text-rose-600">{err("nom")}</p>}
          </div>
          <div>
            <label className={label}>Téléphone *</label>
            <input required className={field} value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="+241 06 61 12 33" inputMode="tel" />
            {err("telephone") ? <p className="mt-1 text-xs font-medium text-rose-600">{err("telephone")}</p> : <p className="mt-1 text-xs text-ge7-black/40">Il servira aussi pour le suivi de votre commande.</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Ville *</label>
              <select required className={field} value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })}>
                <option value="">Choisir…</option>
                {zones?.map((z) => <option key={z.id} value={z.name}>{z.name}</option>)}
                <option value="__autre__">Autre ville…</option>
              </select>
              {form.ville === "__autre__" && (
                <input required className={`${field} mt-2`} value={form.villeAutre} onChange={(e) => setForm({ ...form, villeAutre: e.target.value })} placeholder="Votre ville" />
              )}
              {err("ville") && <p className="mt-1 text-xs font-medium text-rose-600">{err("ville")}</p>}
            </div>
            <div>
              <label className={label}>Quartier *</label>
              <input required maxLength={100} className={field} value={form.quartier} onChange={(e) => setForm({ ...form, quartier: e.target.value })} placeholder="Ex. Glass" />
              {err("quartier") && <p className="mt-1 text-xs font-medium text-rose-600">{err("quartier")}</p>}
            </div>
          </div>
          <div>
            <label className={label}>Point de repère *</label>
            <div className="relative">
              <MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ge7-black/40" />
              <input required maxLength={150} className={`${field} pl-9`} value={form.point_repere} onChange={(e) => setForm({ ...form, point_repere: e.target.value })} placeholder="Ex. Face à la pharmacie du rond-point" />
            </div>
            <p className="mt-1 text-xs text-ge7-black/40">Aidez le chauffeur à vous trouver facilement.</p>
            {err("point_repere") && <p className="mt-1 text-xs font-medium text-rose-600">{err("point_repere")}</p>}
          </div>
          <div>
            <label className={label}>Note de livraison (facultatif)</label>
            <textarea maxLength={500} rows={2} className={field} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Instructions particulières…" />
          </div>
          {/* Honeypot invisible les robots le remplissent, pas les humains. */}
          <input type="text" name="site_web" value={form.site_web} onChange={(e) => setForm({ ...form, site_web: e.target.value })} tabIndex={-1} autoComplete="off" className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden="true" />
        </div>

        <div className="h-fit space-y-4">
          <div className="rounded-2xl border border-ge7-black/10 bg-white p-5">
            <p className="text-sm font-bold">Récapitulatif</p>
            <ul className="mt-3 space-y-2 text-sm">
              {cart.items.map((i) => (
                <li key={i.produit_id} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">{i.quantite} × {i.designation}</span>
                  <span className="shrink-0 font-semibold">{money(i.prix * i.quantite)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between border-t border-ge7-black/10 pt-3">
              <span className="text-sm font-bold">Total</span>
              <span className="text-xl font-extrabold text-ge7-bronze">{money(cart.total)}</span>
            </div>
            <p className="mt-1 text-xs text-ge7-black/50">Prix confirmé par nos équipes à la validation de la commande.</p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-[#151515] px-4 py-3 text-white">
            <Wallet size={18} className="shrink-0 text-ge7-gold" />
            <p className="text-sm font-semibold">Paiement à la livraison</p>
          </div>

          {commander.isError && Object.keys(errors).length === 0 && (
            <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">La commande n'a pas pu être enregistrée. Réessayez.</p>
          )}
          {err("lignes") && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{err("lignes")}</p>}

          <button
            type="submit"
            disabled={commander.isPending}
            className="w-full rounded-full bg-ge7-gold px-5 py-3.5 text-sm font-extrabold uppercase tracking-wide text-ge7-black transition hover:brightness-110 disabled:opacity-50"
          >
            {commander.isPending ? "Envoi en cours…" : "Confirmer la commande"}
          </button>
        </div>
      </form>
    </div>
  );
}
