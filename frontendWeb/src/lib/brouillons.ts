import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/lib/auth";

/**
 * Brouillons de saisie (vente caisse, proforma) : enregistrés dans le
 * navigateur, par utilisateur, tant que la vente ou la proforma n'a pas été
 * validée. On quitte la page sans enregistrer → le brouillon reste et peut
 * être repris.
 */

export type TypeBrouillon = "vente" | "proforma";

export interface Brouillon<T = unknown> {
  id: string;
  type: TypeBrouillon;
  /** Nom du client ou « Sans client ». */
  titre: string;
  ville?: string | null;
  lignes: number;
  total: number;
  majLe: string;
  donnees: T;
}

const EVENEMENT = "ge7:brouillons";
const cle = (userId: number) => `ge7.brouillons.${userId}`;
/** Au-delà de 30 jours, un brouillon est oublié. */
const DUREE_MAX = 30 * 24 * 3600 * 1000;

function lire(userId: number): Brouillon[] {
  try {
    const liste = JSON.parse(localStorage.getItem(cle(userId)) ?? "[]") as Brouillon[];
    const limite = Date.now() - DUREE_MAX;
    return Array.isArray(liste) ? liste.filter((b) => new Date(b.majLe).getTime() > limite) : [];
  } catch {
    return [];
  }
}

function ecrire(userId: number, liste: Brouillon[]) {
  try {
    localStorage.setItem(cle(userId), JSON.stringify(liste));
  } catch {
    /* stockage plein ou bloqué : le brouillon est simplement perdu */
  }
  window.dispatchEvent(new Event(EVENEMENT));
}

export function enregistrerBrouillon(userId: number, b: Brouillon) {
  ecrire(userId, [b, ...lire(userId).filter((x) => x.id !== b.id)]);
}

export function supprimerBrouillon(userId: number, id: string) {
  ecrire(userId, lire(userId).filter((x) => x.id !== id));
}

export function lireBrouillon<T>(userId: number, id: string | null): Brouillon<T> | undefined {
  return id ? (lire(userId).find((b) => b.id === id) as Brouillon<T> | undefined) : undefined;
}

function abonner(rappel: () => void) {
  window.addEventListener(EVENEMENT, rappel);
  window.addEventListener("storage", rappel);
  return () => {
    window.removeEventListener(EVENEMENT, rappel);
    window.removeEventListener("storage", rappel);
  };
}

/** Brouillons de l'utilisateur connecté pour un type, les plus récents en premier. */
export function useBrouillons(type: TypeBrouillon): Brouillon[] {
  const { user } = useAuth();
  const brut = useSyncExternalStore(abonner, () => (user ? localStorage.getItem(cle(user.id)) ?? "" : ""));
  // `brut` change à chaque écriture : on relit alors la liste.
  void brut;
  return user ? lire(user.id).filter((b) => b.type === type).sort((a, b) => b.majLe.localeCompare(a.majLe)) : [];
}

/**
 * Sauvegarde automatique d'une saisie en cours : à chaque modification
 * (après une courte pause) et en quittant la page. Saisie vide → brouillon
 * supprimé. Appeler `terminer()` une fois la vente / proforma enregistrée.
 */
export function useBrouillonAuto<T>(
  type: TypeBrouillon,
  idInitial: string | null,
  etat: { vide: boolean; titre: string; ville?: string | null; lignes: number; total: number; donnees: T },
) {
  const { user } = useAuth();
  const [id] = useState(() => idInitial ?? `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const termine = useRef(false);
  const dernier = useRef(etat);
  dernier.current = etat;

  const sauver = () => {
    if (!user || termine.current) return;
    const e = dernier.current;
    if (e.vide) {
      supprimerBrouillon(user.id, id);
      return;
    }
    enregistrerBrouillon(user.id, { id, type, titre: e.titre, ville: e.ville, lignes: e.lignes, total: e.total, majLe: new Date().toISOString(), donnees: e.donnees });
  };

  const empreinte = JSON.stringify(etat);
  useEffect(() => {
    const t = setTimeout(sauver, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empreinte]);

  // Départ de la page (navigation ou fermeture de l'onglet) : sauvegarde immédiate.
  useEffect(() => {
    window.addEventListener("beforeunload", sauver);
    return () => {
      window.removeEventListener("beforeunload", sauver);
      sauver();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    id,
    /** Vente / proforma enregistrée : le brouillon disparaît. */
    terminer: () => {
      termine.current = true;
      if (user) supprimerBrouillon(user.id, id);
    },
  };
}
