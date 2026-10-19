import type { StatutCommande } from "@/types";

export const STATUT_LABELS: Record<StatutCommande, string> = {
  en_attente: "En attente",
  validee: "Validée",
  refusee: "Refusée",
  en_preparation: "En préparation",
  en_livraison: "En livraison",
  livree: "Livrée",
  echec_livraison: "Échec livraison",
  annulee: "Annulée",
};

export const STATUTS: StatutCommande[] = [
  "en_attente",
  "validee",
  "en_preparation",
  "en_livraison",
  "livree",
  "echec_livraison",
  "refusee",
  "annulee",
];

/** Étapes de la frise de suivi client, dans l'ordre du cycle de vie. */
export const FRISE: { statut: StatutCommande; label: string }[] = [
  { statut: "en_attente", label: "Reçue" },
  { statut: "validee", label: "Validée" },
  { statut: "en_preparation", label: "En préparation" },
  { statut: "en_livraison", label: "En livraison" },
  { statut: "livree", label: "Livrée" },
];
