import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PackageSearch } from "lucide-react";
import { toApiError } from "@/lib/api";
import { shopApi } from "./api";

const field = "w-full rounded-xl border border-ge7-black/15 bg-white px-3.5 py-2.5 text-sm focus:border-ge7-gold focus:outline-none";
const label = "mb-1 block text-xs font-bold uppercase tracking-wide text-ge7-black/60";

export function ShopTrackingPage() {
  const navigate = useNavigate();
  const [numero, setNumero] = useState("");
  const [telephone, setTelephone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const suivi = useMutation({
    mutationFn: () => shopApi.suivi(numero.trim(), telephone.trim()),
    onSuccess: (data) => navigate("/suivi/resultat", { state: { suivi: data, numero: numero.trim(), telephone: telephone.trim() } }),
    // Message générique côté serveur : on ne précise jamais lequel des deux est faux.
    onError: (e) => setError(toApiError(e).status === 404 ? "Commande introuvable." : toApiError(e).message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    suivi.mutate();
  };

  return (
    <div className="mx-auto max-w-md py-8">
      <div className="text-center">
        <PackageSearch size={44} className="mx-auto text-ge7-gold" />
        <h1 className="mt-3 font-display text-2xl font-extrabold">Suivre ma commande</h1>
        <p className="mt-1 text-sm text-ge7-black/60">Saisissez votre numéro de commande et le téléphone utilisé à la commande.</p>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-ge7-black/10 bg-white p-5">
        <div>
          <label className={label}>Numéro de commande</label>
          <input required className={`${field} font-mono`} value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="CMD-00045-2026" />
        </div>
        <div>
          <label className={label}>Téléphone</label>
          <input required className={field} value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="+241 06 61 12 33" inputMode="tel" />
        </div>
        {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p>}
        <button type="submit" disabled={suivi.isPending} className="w-full rounded-full bg-ge7-gold px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-ge7-black transition hover:brightness-110 disabled:opacity-50">
          {suivi.isPending ? "Recherche…" : "Voir le suivi"}
        </button>
      </form>
    </div>
  );
}
