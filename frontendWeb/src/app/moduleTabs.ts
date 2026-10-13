import type { ModuleTab } from "@/components/ui";
import type { Role } from "@/types";

const ADMIN_DIR: Role[] = ["LG_ADMIN", "DG_ADMIN"];
const ADMINS: Role[] = [...ADMIN_DIR, "CDG_ADMIN"];
const SUPERADMIN_ONLY: Role[] = ["SUPERADMIN"];

/** Onglets des hubs — chaque entrée de sidebar ouvre une page à onglets. */
export const COMMERCIAL_TABS: ModuleTab[] = [
  { label: "Clients", to: "/clients", roles: ADMINS },
  { label: "Commandes", to: "/commandes", roles: ADMINS },
  { label: "Factures", to: "/factures", roles: ADMINS },
];

export const CATALOGUE_TABS: ModuleTab[] = [
  { label: "Produits", to: "/produits", roles: ADMINS },
  { label: "Catégories", to: "/categories", roles: ADMINS },
  { label: "Unités", to: "/unites", roles: ADMINS },
  { label: "Prix / Barème", to: "/prix", roles: ADMINS },
];

export const APPRO_TABS: ModuleTab[] = [
  { label: "Stock", to: "/stock", roles: ADMINS },
  { label: "Fournisseurs", to: "/fournisseurs", roles: ADMINS },
  { label: "Achats", to: "/achats", roles: ADMINS },
];

export const LOGISTIQUE_TABS: ModuleTab[] = [
  { label: "Tableau de bord", to: "/logistique", roles: ADMIN_DIR },
  { label: "Préparation", to: "/preparation", roles: ADMIN_DIR },
  { label: "Chauffeurs", to: "/chauffeurs", roles: ADMIN_DIR },
  { label: "Véhicules", to: "/vehicules", roles: ADMIN_DIR },
  { label: "Missions", to: "/missions", roles: ADMIN_DIR },
  { label: "Livraisons", to: "/livraisons", roles: ADMIN_DIR },
];

export const DEVIS_TABS: ModuleTab[] = [
  { label: "Devis", to: "/devis", roles: ADMINS },
];

export const SYSTEME_TABS: ModuleTab[] = [
  { label: "Paramètres", to: "/parametres", roles: ["SUPERADMIN"] },
  { label: "Audit", to: "/audit", roles: SUPERADMIN_ONLY },
];
