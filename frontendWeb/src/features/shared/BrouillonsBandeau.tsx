import { useNavigate } from "react-router-dom";
import { FilePen, MapPin, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { datetime, money } from "@/lib/format";
import { supprimerBrouillon, useBrouillons, type TypeBrouillon } from "@/lib/brouillons";

/**
 * Brouillons non enregistrés (vente caisse ou proforma) : un clic reprend la
 * saisie là où elle s'était arrêtée ; la croix supprime le brouillon.
 */
export function BrouillonsBandeau({ type, chemin, sauf }: { type: TypeBrouillon; chemin: string; sauf?: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const brouillons = useBrouillons(type).filter((b) => b.id !== sauf);

  if (!user || brouillons.length === 0) return null;

  return (
    <div className="mb-4 rounded-2xl border border-dashed border-ge7-bronze/40 bg-ge7-gold-soft/30 p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-bold">
        <FilePen size={15} className="text-ge7-bronze" />
        Brouillons non enregistrés ({brouillons.length})
        <span className="font-normal text-ge7-black/50">· cliquez pour continuer</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {brouillons.map((b) => (
          <div key={b.id} className="flex items-stretch overflow-hidden rounded-xl border border-ge7-black/10 bg-white text-left shadow-sm transition hover:border-ge7-gold">
            <button type="button" onClick={() => navigate(`${chemin}?brouillon=${encodeURIComponent(b.id)}`)} className="px-3 py-2 text-left">
              <p className="text-sm font-semibold">{b.titre}</p>
              <p className="flex items-center gap-1 text-xs text-ge7-black/50">
                {b.ville && <><MapPin size={11} /> {b.ville} · </>}
                {b.lignes} produit{b.lignes > 1 ? "s" : ""} · <span className="font-semibold text-ge7-bronze">{money(b.total)}</span>
              </p>
              <p className="text-[11px] text-ge7-black/40">{datetime(b.majLe)}</p>
            </button>
            <button
              type="button"
              onClick={() => { if (window.confirm("Supprimer ce brouillon ?")) supprimerBrouillon(user.id, b.id); }}
              className="border-l border-ge7-black/5 px-2 text-ge7-black/35 hover:bg-rose-50 hover:text-rose-600"
              title="Supprimer le brouillon"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
