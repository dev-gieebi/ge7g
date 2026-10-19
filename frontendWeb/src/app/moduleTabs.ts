import type { ModuleTab } from "@/components/ui";
import type { Role } from "@/types";

const ADMIN_DIR: Role[] = ["LG_ADMIN", "DG_ADMIN"];
const ADMINS: Role[] = [...ADMIN_DIR, "CDG_ADMIN"];
const SUPERADMIN_ONLY: Role[] = ["SUPERADMIN"];

/** Onglets des hubs — chaque entrée de sidebar ouvre une page à onglets. */
export const COMMERCIAL_TABS: ModuleTab[] = [
  { label: "Clients", to: "/admin/clients", roles: ADMINS },
  { label: "Commandes", to: "/admin/commandes", roles: ADMINS },
  { label: "Factures", to: "/admin/factures", roles: ADMINS },
];

export const CATALOGUE_TABS: ModuleTab[] = [
  { label: "Produits", to: "/admin/produits", roles: ADMINS },
  { label: "Catégories", to: "/admin/categories", roles: ADMINS },
  { label: "Unités", to: "/admin/unites", roles: ADMINS },
  { label: "Prix / Barème", to: "/admin/prix", roles: ADMINS },
];

export const APPRO_TABS: ModuleTab[] = [
  { label: "Stock", to: "/admin/stock", roles: ADMINS },
  { label: "Fournisseurs", to: "/admin/fournisseurs", roles: ADMINS },
  { label: "Achats", to: "/admin/achats", roles: ADMINS },
];

export const LOGISTIQUE_TABS: ModuleTab[] = [
  { label: "Tableau de bord", to: "/admin/logistique", roles: ADMIN_DIR },
  { label: "Chauffeurs", to: "/admin/chauffeurs", roles: ADMIN_DIR },
];

export const DEVIS_TABS: ModuleTab[] = [
  { label: "Devis", to: "/admin/devis", roles: ADMINS },
];

export const SYSTEME_TABS: ModuleTab[] = [
  { label: "Paramètres", to: "/admin/parametres", roles: ["SUPERADMIN"] },
  { label: "Audit", to: "/admin/audit", roles: SUPERADMIN_ONLY },
];
