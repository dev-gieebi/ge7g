import { useEffect, useState, type ReactNode } from "react";

type Props = {
  /** URL de l'image ; vide → `fallback`. */
  src?: string | null;
  alt?: string;
  className?: string;
  loading?: "lazy" | "eager";
  /** Affiché si pas d'image ou si le fichier est introuvable (404…). */
  fallback: ReactNode;
};

/** Affiche l'image si elle existe et se charge, sinon le contenu de repli (initiales du produit). */
export function ImageOuInitiales({ src, alt = "", className, loading, fallback }: Props) {
  const [enErreur, setEnErreur] = useState(false);

  // Nouvelle URL → on retente le chargement.
  useEffect(() => setEnErreur(false), [src]);

  if (!src || enErreur) return <>{fallback}</>;

  return <img src={src} alt={alt} loading={loading} className={className} onError={() => setEnErreur(true)} />;
}

/** Initiales d'un nom de produit (2 premières lettres). */
export function initiales(nom: string | null | undefined, n = 2): string {
  return (nom ?? "").trim().slice(0, n).toUpperCase() || "?";
}
