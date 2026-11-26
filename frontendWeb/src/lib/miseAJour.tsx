import { useSyncExternalStore } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Mise à jour automatique après une mise en ligne : l'utilisateur n'a pas à
 * recharger la page pour profiter des nouvelles fonctionnalités.
 *
 * - /version.json (publié à chaque compilation) est consulté toutes les
 *   minutes et à chaque retour sur l'onglet ;
 * - nouvelle version détectée : rechargement au prochain changement de page,
 *   ou tout de suite si l'onglet est en arrière-plan (personne ne le
 *   regarde) ; un bandeau propose aussi de mettre à jour immédiatement ;
 * - fichier de l'ancienne version introuvable (supprimé par la mise en
 *   ligne) : rechargement immédiat.
 * Les brouillons (caisse, proforma) sont enregistrés avant chaque
 * rechargement (voir lib/brouillons.ts).
 */

let nouvelleVersion = false;
const abonnes = new Set<() => void>();
const signaler = () => abonnes.forEach((f) => f());

async function verifier() {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return;
    const { version } = (await res.json()) as { version?: string };
    if (version && version !== __APP_VERSION__ && !nouvelleVersion) {
      nouvelleVersion = true;
      signaler();
      if (document.visibilityState === "hidden") recharger();
    }
  } catch {
    /* hors ligne : on réessaiera */
  }
}

export function recharger() {
  window.location.reload();
}

/** À appeler une fois au démarrage, avec le routeur de l'application. */
export function demarrerMiseAJourAuto(router: { subscribe: (fn: (state: { location: { pathname: string } }) => void) => () => void }) {
  // Développement (vite dev) : pas de version.json, rien à surveiller.
  if (import.meta.env.DEV) return;

  // Ancien fichier JS supprimé par la mise en ligne : on charge la nouvelle version.
  window.addEventListener("vite:preloadError", (e) => {
    e.preventDefault();
    recharger();
  });

  void verifier();
  window.setInterval(() => void verifier(), 60_000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void verifier();
    else if (nouvelleVersion) recharger();
  });

  // Nouvelle version prête : elle se charge au prochain changement de page.
  let page = window.location.pathname;
  router.subscribe((state) => {
    if (state.location.pathname !== page) {
      page = state.location.pathname;
      if (nouvelleVersion) recharger();
    }
  });
}

/** Bandeau discret proposant d'appliquer tout de suite la nouvelle version. */
export function BandeauMiseAJour() {
  const disponible = useSyncExternalStore(
    (f) => { abonnes.add(f); return () => abonnes.delete(f); },
    () => nouvelleVersion,
  );
  if (!disponible) return null;

  return (
    <div className="no-print fixed inset-x-0 bottom-4 z-[80] flex justify-center px-4">
      <button
        type="button"
        onClick={recharger}
        className="flex items-center gap-2 rounded-full bg-ge7-black px-4 py-2.5 text-sm font-semibold text-white shadow-soft hover:bg-ge7-black/90"
      >
        <RefreshCw size={15} className="text-ge7-gold" />
        Nouvelle version disponible : <span className="text-ge7-gold-light underline">mettre à jour</span>
      </button>
    </div>
  );
}
