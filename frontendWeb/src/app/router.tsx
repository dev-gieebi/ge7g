import { createBrowserRouter, Link, Navigate, useLocation } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { HomeRedirect, RequireAuth, RequireRole } from "./guards";
import { LoginPage } from "@/features/auth/LoginPage";
import { ForbiddenPage } from "@/features/shared/ForbiddenPage";
import { CartProvider } from "@/features/shop/cart";
import { ShopLayout } from "@/features/shop/ShopLayout";
import { ShopHomePage } from "@/features/shop/ShopHomePage";
import { ShopCatalogPage } from "@/features/shop/ShopCatalogPage";
import { ShopProductPage } from "@/features/shop/ShopProductPage";
import { ShopCartPage } from "@/features/shop/ShopCartPage";
import { ShopCheckoutPage } from "@/features/shop/ShopCheckoutPage";
import { ShopConfirmationPage } from "@/features/shop/ShopConfirmationPage";
import { ShopTrackingPage } from "@/features/shop/ShopTrackingPage";
import { ShopTrackingResultPage } from "@/features/shop/ShopTrackingResultPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ClientsPage } from "@/features/clients/ClientsPage";
import { ClientDetailPage } from "@/features/clients/ClientDetailPage";
import { ProductsPage } from "@/features/products/ProductsPage";
import { CategoriesPage } from "@/features/products/CategoriesPage";
import { UnitsPage } from "@/features/products/UnitsPage";
import { PricesPage } from "@/features/prices/PricesPage";
import { StockPage } from "@/features/stock/StockPage";
import { SuppliersPage } from "@/features/suppliers/SuppliersPage";
import { PurchasesPage } from "@/features/purchases/PurchasesPage";
import { OrdersPage } from "@/features/orders/OrdersPage";
import { OrderDetailPage } from "@/features/orders/OrderDetailPage";
import { LogisticsDashboardPage } from "@/features/logistics/LogisticsDashboardPage";
import { DriversPage } from "@/features/logistics/DriversPage";
import { DriverHomePage } from "@/features/logistics/DriverHomePage";
import { PosPage } from "@/features/pos/PosPage";
import { PosSalesPage } from "@/features/pos/PosSalesPage";
import { PosSaleDetailPage } from "@/features/pos/PosSaleDetailPage";
import { QuotesPage } from "@/features/quotes/QuotesPage";
import { QuoteNewPage } from "@/features/quotes/QuoteNewPage";
import { QuoteDetailPage } from "@/features/quotes/QuoteDetailPage";
import { InvoicesPage } from "@/features/invoices/InvoicesPage";
import { InvoiceDetailPage } from "@/features/invoices/InvoiceDetailPage";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { NotificationsPage } from "@/features/notifications/NotificationsPage";
import { AuditPage } from "@/features/audit/AuditPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { Button } from "@/components/ui";

function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-ge7-cream text-center">
      <div>
        <p className="font-display text-6xl font-extrabold text-ge7-gold">404</p>
        <p className="mt-2 text-ge7-black/60">Page introuvable.</p>
        <Link to="/"><Button className="mt-6">Retour à la boutique</Button></Link>
      </div>
    </div>
  );
}

/** Redirige les anciens chemins du back-office vers leur équivalent /admin/*. */
function LegacyRedirect() {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={`/admin${pathname}${search}${hash}`} replace />;
}

/**
 * Anciennes routes admin à rediriger. `/produits` n'y figure pas : c'est
 * désormais le catalogue public (le back-office utilise /admin/produits).
 */
const LEGACY_ADMIN_PATHS = [
  "dashboard", "clients", "commandes", "factures", "prix", "stock", "achats",
  "missions", "livraisons", "logistique", "categories", "unites", "fournisseurs",
  "preparation", "chauffeurs", "vehicules", "parametres", "devis", "rapports",
  "caisse", "notifications", "audit",
];

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/403", element: <ForbiddenPage /> },

  // ===== Boutique publique — visible par tous, sans compte. =====
  {
    element: (
      <CartProvider>
        <ShopLayout />
      </CartProvider>
    ),
    children: [
      { path: "/", element: <ShopHomePage /> },
      { path: "/produits", element: <ShopCatalogPage /> },
      { path: "/produits/:id", element: <ShopProductPage /> },
      { path: "/panier", element: <ShopCartPage /> },
      { path: "/commande", element: <ShopCheckoutPage /> },
      { path: "/commande/confirmation/:numero", element: <ShopConfirmationPage /> },
      { path: "/suivi", element: <ShopTrackingPage /> },
      { path: "/suivi/resultat", element: <ShopTrackingResultPage /> },
    ],
  },

  // ===== Espace personnel — derrière le bouton « Connexion » (/admin/*). =====
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/admin", element: <HomeRedirect /> },

          {
            element: <RequireRole roles={["LG_ADMIN", "DG_ADMIN", "CDG_ADMIN"]} />,
            children: [
              { path: "/admin/dashboard", element: <DashboardPage /> },
              { path: "/admin/clients", element: <ClientsPage /> },
              { path: "/admin/clients/:id", element: <ClientDetailPage /> },
              { path: "/admin/commandes", element: <OrdersPage /> },
              { path: "/admin/commandes/:id", element: <OrderDetailPage /> },
              { path: "/admin/factures", element: <InvoicesPage /> },
              { path: "/admin/factures/:id", element: <InvoiceDetailPage /> },
              { path: "/admin/produits", element: <ProductsPage /> },
              { path: "/admin/prix", element: <PricesPage /> },
              { path: "/admin/stock", element: <StockPage /> },
              { path: "/admin/achats", element: <PurchasesPage /> },
              // Anciennes pages logistiques B2B (missions/véhicules/chantiers)
              // remplacées par le flux boutique : chauffeurs + livraisons.
              { path: "/admin/missions/*", element: <Navigate to="/admin/logistique" replace /> },
              { path: "/admin/livraisons/*", element: <Navigate to="/admin/logistique" replace /> },
              { path: "/admin/preparation", element: <Navigate to="/admin/logistique" replace /> },
              { path: "/admin/vehicules", element: <Navigate to="/admin/logistique" replace /> },
            ],
          },
          {
            element: <RequireRole roles={["LG_ADMIN", "DG_ADMIN", "CDG_ADMIN"]} />,
            children: [
              { path: "/admin/logistique", element: <LogisticsDashboardPage /> },
              { path: "/admin/categories", element: <CategoriesPage /> },
              { path: "/admin/unites", element: <UnitsPage /> },
              { path: "/admin/fournisseurs", element: <SuppliersPage /> },
              { path: "/admin/chauffeurs", element: <DriversPage /> },
            ],
          },
          {
            // Paramètres système : Super administrateur uniquement.
            element: <RequireRole roles={["SUPERADMIN"]} />,
            children: [
              { path: "/admin/parametres", element: <SettingsPage /> },
            ],
          },
          {
            // Circuit facturation : devis et suivi des ventes.
            element: <RequireRole roles={["LG_ADMIN", "DG_ADMIN", "CDG_ADMIN"]} />,
            children: [
              { path: "/admin/devis", element: <QuotesPage /> },
              { path: "/admin/devis/nouveau", element: <QuoteNewPage /> },
              { path: "/admin/devis/:id", element: <QuoteDetailPage /> },
            ],
          },
          {
            // Rapports de suivi : Direction + CDG_ADMIN (LG_ADMIN n'y a pas accès).
            element: <RequireRole roles={["DG_ADMIN", "CDG_ADMIN"]} />,
            children: [{ path: "/admin/rapports", element: <ReportsPage /> }],
          },
          {
            // Espace chauffeur : ses livraisons uniquement (filtre serveur).
            // strict : même le SUPERADMIN n'y a pas accès — c'est l'espace
            // personnel du chauffeur connecté.
            element: <RequireRole roles={["CHAUFFEUR"]} strict />,
            children: [
              { path: "/admin/mes-livraisons", element: <DriverHomePage /> },
              { path: "/admin/mes-livraisons/:id", element: <OrderDetailPage /> },
            ],
          },
          {
            element: <RequireRole roles={["LG_ADMIN", "CAISSIER"]} />,
            children: [{ path: "/admin/caisse", element: <PosPage /> }],
          },
          {
            element: <RequireRole roles={["LG_ADMIN", "DG_ADMIN", "CDG_ADMIN", "CAISSIER"]} />,
            children: [
              { path: "/admin/caisse/ventes", element: <PosSalesPage /> },
              { path: "/admin/notifications", element: <NotificationsPage /> },
            ],
          },
          {
            // Le ticket de caisse est visible par le caissier après encaissement.
            element: <RequireRole roles={["LG_ADMIN", "DG_ADMIN", "CAISSIER", "CDG_ADMIN"]} />,
            children: [{ path: "/admin/caisse/ventes/:id", element: <PosSaleDetailPage /> }],
          },
          {
            element: <RequireRole roles={["SUPERADMIN"]} />,
            children: [
              { path: "/admin/audit", element: <AuditPage /> },
            ],
          },
        ],
      },
    ],
  },

  // ===== Compatibilité : anciens chemins admin redirigés vers /admin/*. =====
  ...LEGACY_ADMIN_PATHS.map((p) => ({ path: `/${p}/*`, element: <LegacyRedirect /> })),

  { path: "*", element: <NotFound /> },
]);
