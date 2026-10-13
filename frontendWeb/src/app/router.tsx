import { createBrowserRouter, Link } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { HomeRedirect, RequireAuth, RequireRole } from "./guards";
import { LoginPage } from "@/features/auth/LoginPage";
import { ForbiddenPage } from "@/features/shared/ForbiddenPage";
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
import { PreparationPage } from "@/features/logistics/PreparationPage";
import { LogisticsDashboardPage } from "@/features/logistics/LogisticsDashboardPage";
import { DriversPage } from "@/features/logistics/DriversPage";
import { VehiclesPage } from "@/features/logistics/VehiclesPage";
import { MissionsPage } from "@/features/missions/MissionsPage";
import { MissionDetailPage } from "@/features/missions/MissionDetailPage";
import { DeliveriesPage } from "@/features/deliveries/DeliveriesPage";
import { DeliveryDetailPage } from "@/features/deliveries/DeliveryDetailPage";
import { NewDeliveryPage } from "@/features/deliveries/NewDeliveryPage";
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
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div>
        <p className="font-display text-6xl font-extrabold text-ge7-gold">404</p>
        <p className="mt-2 text-ge7-black/60">Page introuvable.</p>
        <Link to="/"><Button className="mt-6">Retour à l'accueil</Button></Link>
      </div>
    </div>
  );
}

/**
 * Application Web = plateforme interne G7 Energy.
 * Aucun espace CLIENT ni CHAUFFEUR : ces rôles utilisent l'application mobile.
 */
export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/403", element: <ForbiddenPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <HomeRedirect /> },

          {
            element: <RequireRole roles={["LG_ADMIN", "DG_ADMIN", "CDG_ADMIN"]} />,
            children: [
              { path: "/dashboard", element: <DashboardPage /> },
              { path: "/clients", element: <ClientsPage /> },
              { path: "/clients/:id", element: <ClientDetailPage /> },
              { path: "/commandes", element: <OrdersPage /> },
              { path: "/commandes/:id", element: <OrderDetailPage /> },
              { path: "/factures", element: <InvoicesPage /> },
              { path: "/factures/:id", element: <InvoiceDetailPage /> },
              { path: "/produits", element: <ProductsPage /> },
              { path: "/prix", element: <PricesPage /> },
              { path: "/stock", element: <StockPage /> },
              { path: "/achats", element: <PurchasesPage /> },
              { path: "/missions", element: <MissionsPage /> },
              { path: "/missions/:id", element: <MissionDetailPage /> },
              { path: "/livraisons", element: <DeliveriesPage /> },
              { path: "/livraisons/nouvelle", element: <NewDeliveryPage /> },
              { path: "/livraisons/:id", element: <DeliveryDetailPage /> },
            ],
          },
          {
            element: <RequireRole roles={["LG_ADMIN", "DG_ADMIN", "CDG_ADMIN"]} />,
            children: [
              { path: "/logistique", element: <LogisticsDashboardPage /> },
              { path: "/categories", element: <CategoriesPage /> },
              { path: "/unites", element: <UnitsPage /> },
              { path: "/fournisseurs", element: <SuppliersPage /> },
              { path: "/preparation", element: <PreparationPage /> },
              { path: "/chauffeurs", element: <DriversPage /> },
              { path: "/vehicules", element: <VehiclesPage /> },
            ],
          },
          {
            // Paramètres système : Super administrateur uniquement.
            element: <RequireRole roles={["SUPERADMIN"]} />,
            children: [
              { path: "/parametres", element: <SettingsPage /> },
            ],
          },
          {
            // Circuit facturation : devis et suivi des ventes.
            element: <RequireRole roles={["LG_ADMIN", "DG_ADMIN", "CDG_ADMIN"]} />,
            children: [
              { path: "/devis", element: <QuotesPage /> },
              { path: "/devis/nouveau", element: <QuoteNewPage /> },
              { path: "/devis/:id", element: <QuoteDetailPage /> },
            ],
          },
          {
            // Rapports de suivi : Direction + CDG_ADMIN (LG_ADMIN n'y a pas accès).
            element: <RequireRole roles={["DG_ADMIN", "CDG_ADMIN"]} />,
            children: [{ path: "/rapports", element: <ReportsPage /> }],
          },
          {
            element: <RequireRole roles={["LG_ADMIN", "CAISSIER"]} />,
            children: [{ path: "/caisse", element: <PosPage /> }],
          },
          {
            element: <RequireRole roles={["LG_ADMIN", "DG_ADMIN", "CDG_ADMIN", "CAISSIER"]} />,
            children: [
              { path: "/caisse/ventes", element: <PosSalesPage /> },
              { path: "/notifications", element: <NotificationsPage /> },
            ],
          },
          {
            // Le ticket de caisse est visible par le caissier après encaissement.
            element: <RequireRole roles={["LG_ADMIN", "DG_ADMIN", "CAISSIER", "CDG_ADMIN"]} />,
            children: [{ path: "/caisse/ventes/:id", element: <PosSaleDetailPage /> }],
          },
          {
            element: <RequireRole roles={["SUPERADMIN"]} />,
            children: [
              { path: "/audit", element: <AuditPage /> },
            ],
          },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
]);
