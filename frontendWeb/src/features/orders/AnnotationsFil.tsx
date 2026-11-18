import { useState } from "react";
import { MessageSquareText, Send } from "lucide-react";
import { datetime } from "@/lib/format";

export interface AnnotationItem {
  id: number;
  auteur: "client" | "equipe";
  nom: string;
  contenu: string;
  created_at: string;
}

/**
 * Fil des annotations d'une commande, partagé entre l'espace client et le
 * back-office : les messages du point de vue courant (`moi`) sont alignés à
 * droite.
 */
export function AnnotationsFil({
  annotations,
  moi,
  onEnvoyer,
  envoi = false,
  placeholder = "Ajouter une annotation…",
}: {
  annotations: AnnotationItem[];
  moi: "client" | "equipe";
  onEnvoyer?: (contenu: string) => Promise<unknown>;
  envoi?: boolean;
  placeholder?: string;
}) {
  const [texte, setTexte] = useState("");

  const envoyer = () => {
    const contenu = texte.trim();
    if (!contenu || !onEnvoyer) return;
    onEnvoyer(contenu).then(() => setTexte("")).catch(() => {});
  };

  return (
    <div>
      {annotations.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl bg-ge7-black/[0.03] px-3.5 py-3 text-sm text-ge7-black/50">
          <MessageSquareText size={15} /> Aucune annotation sur cette commande.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {annotations.map((a) => {
            const mien = a.auteur === moi;
            return (
              <li key={a.id} className={`flex ${mien ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${mien ? "rounded-br-sm bg-ge7-gold/20" : "rounded-bl-sm bg-ge7-black/[0.05]"}`}>
                  <p className="whitespace-pre-line">{a.contenu}</p>
                  <p className="mt-1 text-[11px] text-ge7-black/45">
                    {a.nom}
                    {a.auteur === "client" && moi === "equipe" ? " (client)" : ""} · {datetime(a.created_at)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {onEnvoyer && (
        <div className="mt-3 flex items-end gap-2">
          <textarea
            rows={2}
            maxLength={1000}
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            placeholder={placeholder}
            className="min-w-0 flex-1 rounded-xl border border-ge7-black/15 bg-white px-3 py-2 text-sm focus:border-ge7-gold focus:outline-none"
          />
          <button
            type="button"
            onClick={envoyer}
            disabled={envoi || texte.trim() === ""}
            className="inline-flex items-center gap-1.5 rounded-xl bg-ge7-black px-3.5 py-2.5 text-sm font-bold text-ge7-gold-light transition hover:brightness-125 disabled:opacity-40"
          >
            <Send size={14} /> Envoyer
          </button>
        </div>
      )}
    </div>
  );
}
