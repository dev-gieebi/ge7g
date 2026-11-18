import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Paginated } from "@/types";
import type { CommandePayload, SuiviEtape } from "./api";

/** API de l'espace client connecté (`/api/client/*`, rôle CLIENT). */

export interface ProfilClient {
  nom: string;
  telephone: string | null;
  /** Ville imposée par le compte, `null` = accès à toutes les villes. */
  zone: { id: number; name: string } | null;
  /** Commandes ayant du nouveau depuis la dernière consultation. */
  non_lues: number;
}

export interface CommandeClientListItem {
  id: number;
  numero: string;
  statut: string;
  statut_libelle: string;
  ville: string;
  total: number;
  remise_statut: RemiseStatut | null;
  non_lu: boolean;
  cree_le: string;
}

export type RemiseStatut = "demandee" | "accordee" | "refusee";

export interface Remise {
  statut: RemiseStatut | null;
  taux_demande: number | null;
  motif: string | null;
  taux: number;
  montant: number;
}

export interface Annotation {
  id: number;
  auteur: "client" | "equipe";
  nom: string;
  contenu: string;
  created_at: string;
}

export interface CommandeClient {
  id: number;
  numero: string;
  statut: string;
  statut_libelle: string;
  motif: string | null;
  cree_le: string;
  validee_le: string | null;
  etapes: SuiviEtape[];
  client: { nom: string; telephone: string };
  adresse: { ville: string; quartier: string; point_repere: string };
  note: string | null;
  lignes: { id: number; designation: string; prix_unitaire: number; quantite: number; total_ligne: number; unite: string | null }[];
  sous_total: number;
  remise: Remise;
  total: number;
  extras: { label: string; amount: number }[];
  facture: { numero: string; statut_paiement: string; montant_total: number; encaisse: number } | null;
  chauffeur: string | null;
  position: { latitude: number; longitude: number; maj_le: string | null } | null;
  /** Données du bon de livraison, présentes une fois la commande livrée. */
  livraison: { livree_le: string | null; receptionnaire: string | null } | null;
  /** Bon de livraison généré à la confirmation de la livraison (BL-xxxxx-AAAA). */
  bon_livraison: { numero: string; livre_le: string | null; receptionnaire: string | null } | null;
  annotations: Annotation[];
  journal: { libelle: string; commentaire: string | null; created_at: string }[];
}

export interface CommandeClientPayload extends Omit<CommandePayload, "site_web"> {
  annotation?: string;
  remise_taux?: number;
  remise_motif?: string;
}

export const clientApi = {
  profil: () => api.get<{ data: ProfilClient }>("/client/profil").then((r) => r.data.data),
  commandes: (page: number, etat?: "en_cours" | "terminees") =>
    api.get<Paginated<CommandeClientListItem>>("/client/commandes", { params: { page, etat } }).then((r) => r.data),
  commande: (id: number | string) => api.get<{ data: CommandeClient }>(`/client/commandes/${id}`).then((r) => r.data.data),
  commander: (payload: CommandeClientPayload) =>
    api.post<{ data: { id: number; numero: string; total: number; statut: string } }>("/client/commandes", payload).then((r) => r.data.data),
  annoter: (id: number, contenu: string) =>
    api.post<{ data: CommandeClient }>(`/client/commandes/${id}/annotations`, { contenu }).then((r) => r.data.data),
  demanderRemise: (id: number, remise_taux: number, remise_motif?: string) =>
    api.post<{ data: CommandeClient }>(`/client/commandes/${id}/remise`, { remise_taux, remise_motif }).then((r) => r.data.data),
};

/** Vrai si l'utilisateur connecté est un compte CLIENT (espace client). */
export function useEstClient() {
  const { user } = useAuth();
  return user?.role === "CLIENT";
}

/** Profil du client connecté (ville d'accès, nouveautés), rafraîchi chaque minute. */
export function useProfilClient() {
  const estClient = useEstClient();
  return useQuery({ queryKey: ["client", "profil"], queryFn: clientApi.profil, enabled: estClient, refetchInterval: 60_000 });
}
