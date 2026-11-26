import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Paginated } from "@/types";
import type { CommandePayload, ShopPaginated, SuiviEtape } from "./api";

/** API de l'espace client connecté (`/api/client/*`, rôle CLIENT). */

export interface ProfilClient {
  nom: string;
  telephone: string | null;
  /** Ville imposée par le compte, `null` = accès à toutes les villes. */
  zone: { id: number; name: string } | null;
  /** Commandes ayant du nouveau depuis la dernière consultation. */
  non_lues: number;
  /** Commandes pas encore arrivées chez le client (hors livrées, refusées, annulées). */
  en_cours: number;
}

export interface CommandeClientListItem {
  /** Clé opaque de l'adresse (URL) à la place de l'identifiant. */
  cle?: string;
  id: number;
  numero: string;
  statut: string;
  statut_libelle: string;
  ville: string;
  /** Prix masqués au client tant que la facture n'est pas émise. */
  total: number | null;
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
  montant: number | null;
}

export interface Annotation {
  id: number;
  auteur: "client" | "equipe";
  nom: string;
  contenu: string;
  created_at: string;
}

export interface CommandeClient {
  /** Clé opaque de l'adresse (URL) à la place de l'identifiant. */
  cle?: string;
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
  /** Prix (`prix_unitaire`, `total_ligne`, totaux) à `null` tant que la facture n'est pas émise. */
  lignes: {
    id: number;
    designation: string;
    precision: string | null;
    /** Produit demandé hors catalogue, pas encore référencé par l'équipe. */
    inconnu: boolean;
    prix_unitaire: number | null;
    quantite: number;
    /** Livraisons partielles : quantité déjà livrée et reste à livrer. */
    quantite_livree: number;
    reste: number;
    total_ligne: number | null;
    unite: string | null;
  }[];
  /** Un bon de livraison par envoi, avec les quantités envoyées. */
  bons_livraison: { numero: string; livre_le: string | null; lignes: { designation: string; quantite: number }[] }[];
  sous_total: number | null;
  remise: Remise;
  total: number | null;
  extras: { label: string; amount: number }[];
  /** `soldee_le` : facture soldée, définitif (tampon « Soldé »). */
  facture: { numero: string; statut_paiement: string; montant_total: number; encaisse: number; soldee_le: string | null } | null;
  chauffeur: string | null;
  position: { latitude: number; longitude: number; maj_le: string | null } | null;
  /** Données du bon de livraison, présentes une fois la commande livrée. */
  livraison: { livree_le: string | null; receptionnaire: string | null } | null;
  /** Bon de livraison généré à la confirmation de la livraison (BL-xxxxx-AAAA). */
  bon_livraison: { numero: string; livre_le: string | null; receptionnaire: string | null } | null;
  annotations: Annotation[];
  journal: { libelle: string; commentaire: string | null; created_at: string }[];
}

/** Produit du catalogue tel que le voit le client : ni prix ni stock. */
export interface ProduitClient {
  id: number;
  reference: string;
  designation: string;
  description: string | null;
  categorie: string | null;
  unite: string | null;
  image: string | null;
}

/** Ligne demandée : produit du catalogue (`produit_id`) ou produit inconnu (`designation` libre). */
export interface LigneDemandee {
  produit_id?: number;
  designation?: string;
  precision?: string;
  quantite: number;
}

/** Archive : une commande facturée, sa facture et son bon de livraison. */
export interface DocumentsCommande {
  /** Clé opaque de l'adresse (URL) à la place de l'identifiant. */
  cle?: string;
  commande_id: number;
  commande: string;
  statut_libelle: string;
  facture: { numero: string; emise_le: string | null; montant_total: number; soldee_le: string | null };
  bon_livraison: { numero: string; livre_le: string | null } | null;
}

export interface CommandeClientPayload extends Omit<CommandePayload, "site_web" | "lignes"> {
  lignes: LigneDemandee[];
  annotation?: string;
}

export const clientApi = {
  profil: () => api.get<{ data: ProfilClient }>("/client/profil").then((r) => r.data.data),
  produits: (params: { page: number; search?: string; categorie?: number }) =>
    api.get<ShopPaginated<ProduitClient>>("/client/produits", { params }).then((r) => r.data),
  commandes: (page: number, etat?: "en_cours" | "terminees") =>
    api.get<Paginated<CommandeClientListItem>>("/client/commandes", { params: { page, etat } }).then((r) => r.data),
  documents: (page: number) => api.get<ShopPaginated<DocumentsCommande>>("/client/documents", { params: { page } }).then((r) => r.data),
  commande: (id: number | string) => api.get<{ data: CommandeClient }>(`/client/commandes/${id}`).then((r) => r.data.data),
  commander: (payload: CommandeClientPayload) =>
    api.post<{ data: { id: number; cle?: string; numero: string; total: number; statut: string } }>("/client/commandes", payload).then((r) => r.data.data),
  ajouterLignes: (id: number | string, lignes: LigneDemandee[]) =>
    api.post<{ data: CommandeClient }>(`/client/commandes/${id}/lignes`, { lignes }).then((r) => r.data.data),
  annoter: (id: number | string, contenu: string) =>
    api.post<{ data: CommandeClient }>(`/client/commandes/${id}/annotations`, { contenu }).then((r) => r.data.data),
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
