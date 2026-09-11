import type { ModuleTab } from "@/components/ui";
import type { Role } from "@/types";

const ADMIN_DIR: Role[] = ["ADMIN", "DIRECTION"];
const SUPERADMIN_ONLY: Role[] = ["SUPERADMIN"];

/** Onglets des hubs — chaque entrée de sidebar ouvre une page à onglets. */
export const COMMERCIAL_TABS: ModuleTab[] = [
  { label: "Clients", to: "/clients", roles: ADMIN_DIR },
  { label: "Commandes", to: "/commandes", roles: ADMIN_DIR },
  { label: "Factures", to: "/factures", roles: ADMIN_DIR },
];

export const CATALOGUE_TABS: ModuleTab[] = [
  { label: "Produits", to: "/produits", roles: ADMIN_DIR },
  { label: "Catégories", to: "/categories", roles: ADMIN_DIR },
  { label: "Unités", to: "/unites", roles: ADMIN_DIR },
  { label: "Prix / Barème", to: "/prix", roles: ADMIN_DIR },
];

export const APPRO_TABS: ModuleTab[] = [
  { label: "Stock", to: "/stock", roles: ADMIN_DIR },
  { label: "Fournisseurs", to: "/fournisseurs", roles: ADMIN_DIR },
  { label: "Achats", to: "/achats", roles: ADMIN_DIR },
];

export const LOGISTIQUE_TABS: ModuleTab[] = [
  { label: "Tableau de bord", to: "/logistique", roles: ADMIN_DIR },
  { label: "Préparation", to: "/preparation", roles: ADMIN_DIR },
  { label: "Chauffeurs", to: "/chauffeurs", roles: ADMIN_DIR },
  { label: "Véhicules", to: "/vehicules", roles: ADMIN_DIR },
  { label: "Missions", to: "/missions", roles: ADMIN_DIR },
  { label: "Livraisons", to: "/livraisons", roles: ADMIN_DIR },
];

export const CAISSE_TABS: ModuleTab[] = [
  { label: "Point de vente", to: "/caisse", roles: ["ADMIN", "CAISSIER"] },
  { label: "Historique ventes", to: "/caisse/ventes", roles: ADMIN_DIR },
];

export const SYSTEME_TABS: ModuleTab[] = [
  { label: "Paramètres", to: "/parametres", roles: ADMIN_DIR },
  { label: "Audit", to: "/audit", roles: SUPERADMIN_ONLY },
];
