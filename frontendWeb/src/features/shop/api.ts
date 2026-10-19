import { api } from "@/lib/api";

/** Réponses de l'API publique `/api/public` — jamais de prix d'achat ni de stock exact. */

export interface ShopProduit {
  id: number;
  reference: string;
  designation: string;
  description: string | null;
  categorie: string | null;
  prix: number;
  unite: string | null;
  image: string | null;
  mis_en_avant: boolean;
  disponibilite: "disponible" | "stock_limite" | "rupture";
}

export interface ShopCategorie {
  id: number;
  name: string;
}

export interface ShopZone {
  id: number;
  name: string;
}

export interface ShopPaginated<T> {
  data: T[];
  meta: { current_page: number; last_page: number; total: number };
}

export interface SuiviEtape {
  statut: string;
  libelle: string;
  franchie_le: string | null;
}

export interface SuiviCommande {
  numero: string;
  statut: string;
  statut_libelle: string;
  motif: string | null;
  cree_le: string;
  etapes: SuiviEtape[];
  lignes: { designation: string; prix_unitaire: number; quantite: number; total_ligne: number }[];
  total: number;
  ville: string;
  quartier: string;
  chauffeur: string | null;
  /** Position du chauffeur — uniquement pendant la livraison. */
  position: { latitude: number; longitude: number; maj_le: string | null } | null;
}

export interface CommandePayload {
  nom: string;
  telephone: string;
  ville: string;
  quartier: string;
  point_repere: string;
  note?: string;
  zone_id?: number;
  lignes: { produit_id: number; quantite: number }[];
  /** Honeypot anti-robots — doit rester vide. */
  site_web?: string;
}

export const shopApi = {
  categories: () => api.get<{ data: ShopCategorie[] }>("/public/categories").then((r) => r.data.data),
  zones: () => api.get<{ data: ShopZone[] }>("/public/zones").then((r) => r.data.data),
  produits: (params: Record<string, string | number | boolean | undefined>) =>
    api.get<ShopPaginated<ShopProduit>>("/public/produits", { params }).then((r) => r.data),
  produit: (id: number | string, zone?: string | number | null) =>
    api.get<{ data: ShopProduit }>(`/public/produits/${id}`, { params: { zone: zone ?? undefined } }).then((r) => r.data.data),
  commander: (payload: CommandePayload) =>
    api.post<{ data: { numero: string; total: number; statut: string } }>("/public/commandes", payload).then((r) => r.data.data),
  suivi: (numero: string, telephone: string) =>
    api.post<{ data: SuiviCommande }>("/public/suivi", { numero, telephone }).then((r) => r.data.data),
};
