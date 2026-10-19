import { Link, useLocation, useParams } from "react-router-dom";
import { CheckCircle2, Copy, PackageSearch } from "lucide-react";
import { useState } from "react";
import { money } from "@/lib/format";

export function ShopConfirmationPage() {
  const { numero } = useParams();
  const location = useLocation();
  const total = (location.state as { total?: number } | null)?.total;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(numero ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers indisponible */
    }
  };

  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <CheckCircle2 size={56} className="mx-auto text-emerald-500" />
      <h1 className="mt-4 font-display text-2xl font-extrabold">Commande enregistrée</h1>
      <p className="mt-2 text-sm text-ge7-black/60">
        Merci pour votre confiance. Notre équipe valide votre commande et vous contactera pour la livraison.
      </p>

      <div className="mt-6 rounded-2xl border-2 border-dashed border-ge7-gold/60 bg-ge7-gold-soft px-6 py-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ge7-black/50">Votre numéro de commande</p>
        <p className="mt-1 font-mono text-2xl font-extrabold tracking-wider">{numero}</p>
        {typeof total === "number" && <p className="mt-1 text-sm font-bold text-ge7-bronze">{money(total)}  paiement à la livraison</p>}
        <button onClick={() => void copy()} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-ge7-black/15 bg-white px-3.5 py-1.5 text-xs font-bold">
          <Copy size={13} /> {copied ? "Copié !" : "Copier"}
        </button>
      </div>

      <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
        Conservez ce numéro : il vous sera demandé, avec votre téléphone, pour suivre votre commande.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/suivi" className="inline-flex items-center gap-2 rounded-full bg-ge7-gold px-5 py-2.5 text-sm font-bold text-ge7-black">
          <PackageSearch size={16} /> Suivre ma commande
        </Link>
        <Link to="/produits" className="rounded-full border border-ge7-black/15 bg-white px-5 py-2.5 text-sm font-semibold">
          Continuer mes achats
        </Link>
      </div>
    </div>
  );
}
