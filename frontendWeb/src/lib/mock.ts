/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * COUCHE DE DONNÉES FICTIVES (mode démo — aucun backend).
 * Intercepte toutes les requêtes axios et répond avec un jeu de données
 * en mémoire. Pour reconnecter l'API réelle, retirer `adapter: mockAdapter`
 * dans api.ts.
 */
import type { AxiosRequestConfig, AxiosResponse } from "axios";
import type {
  AuditLog, Category, Chantier, Client, Consumption, Delivery, Driver,
  Invoice, Mission, Notification, Order, PosSale, Price, Product, ProductType,
  Purchase, SiteStock, StockMovement, Supplier, Tax, Unit, User, Vehicle, Zone,
} from "@/types";

const now = () => new Date().toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 864e5).toISOString();
const daysAhead = (d: number) => new Date(Date.now() + d * 864e5).toISOString();

/* ------------------------------- Données ------------------------------- */

const zones: Zone[] = [
  { id: 1, name: "FCV et Moanda", code: "FCV", status: "ACTIF" },
  { id: 2, name: "Oyem", code: "OYM", status: "ACTIF" },
  { id: 3, name: "Libreville (LBV)", code: "LBV", status: "ACTIF" },
];

const categories: Category[] = [
  { id: 1, name: "Ciments & liants", slug: "ciments", parent_id: null, products_count: 3 },
  { id: 2, name: "Fer & acier", slug: "fer", parent_id: null, products_count: 3 },
  { id: 3, name: "Agrégats", slug: "agregats", parent_id: null, products_count: 2 },
  { id: 4, name: "Carburants & énergie", slug: "energie", parent_id: null, products_count: 2 },
];

const units: Unit[] = [
  { id: 1, name: "Sac", symbol: "sac", decimals: 0 },
  { id: 2, name: "Tonne", symbol: "t", decimals: 2 },
  { id: 3, name: "Mètre cube", symbol: "m³", decimals: 2 },
  { id: 4, name: "Litre", symbol: "L", decimals: 0 },
  { id: 5, name: "Barre", symbol: "br", decimals: 0 },
];

const productTypes: ProductType[] = [
  { id: 1, name: "Matériau de construction", code: "MAT", products_count: 8, status: "ACTIF" },
  { id: 2, name: "Carburant", code: "CARB", products_count: 2, status: "ACTIF" },
];

const products: Product[] = [
  { id: 1, reference: "CIM-001", name: "Ciment CPJ 45 — sac 50 kg", category_id: 1, category: categories[0], type: "MAT", unit_id: 1, unit: units[0], sale_price: 4500, purchase_price: 3900, margin: 600, margin_percent: 15.4, stock_quantity: 1240, reserved_quantity: 150, available_quantity: 1090, min_stock: 300, image_url: null },
  { id: 2, reference: "CIM-002", name: "Ciment CPJ 35 — sac 50 kg", category_id: 1, category: categories[0], type: "MAT", unit_id: 1, unit: units[0], sale_price: 4200, purchase_price: 3600, margin: 600, margin_percent: 16.7, stock_quantity: 860, reserved_quantity: 0, available_quantity: 860, min_stock: 300, image_url: null },
  { id: 3, reference: "CIM-003", name: "Chaux hydraulique — sac 35 kg", category_id: 1, category: categories[0], type: "MAT", unit_id: 1, unit: units[0], sale_price: 5200, purchase_price: 4400, margin: 800, margin_percent: 18.2, stock_quantity: 120, reserved_quantity: 0, available_quantity: 120, min_stock: 100, image_url: null },
  { id: 4, reference: "FER-008", name: "Fer à béton Ø8 — barre 12 m", category_id: 2, category: categories[1], type: "MAT", unit_id: 5, unit: units[4], sale_price: 3200, purchase_price: 2700, margin: 500, margin_percent: 18.5, stock_quantity: 2400, reserved_quantity: 300, available_quantity: 2100, min_stock: 500, image_url: null },
  { id: 5, reference: "FER-010", name: "Fer à béton Ø10 — barre 12 m", category_id: 2, category: categories[1], type: "MAT", unit_id: 5, unit: units[4], sale_price: 4600, purchase_price: 3900, margin: 700, margin_percent: 17.9, stock_quantity: 1800, reserved_quantity: 0, available_quantity: 1800, min_stock: 400, image_url: null },
  { id: 6, reference: "FER-012", name: "Fer à béton Ø12 — barre 12 m", category_id: 2, category: categories[1], type: "MAT", unit_id: 5, unit: units[4], sale_price: 6100, purchase_price: 5300, margin: 800, margin_percent: 15.1, stock_quantity: 60, reserved_quantity: 0, available_quantity: 60, min_stock: 300, image_url: null },
  { id: 7, reference: "AGR-001", name: "Sable de dunes — m³", category_id: 3, category: categories[2], type: "MAT", unit_id: 3, unit: units[2], sale_price: 14000, purchase_price: 11000, margin: 3000, margin_percent: 27.3, stock_quantity: 95, reserved_quantity: 10, available_quantity: 85, min_stock: 20, image_url: null },
  { id: 8, reference: "AGR-002", name: "Gravier concassé 5/15 — m³", category_id: 3, category: categories[2], type: "MAT", unit_id: 3, unit: units[2], sale_price: 18500, purchase_price: 15000, margin: 3500, margin_percent: 23.3, stock_quantity: 0, reserved_quantity: 0, available_quantity: 0, min_stock: 15, image_url: null },
  { id: 9, reference: "NRJ-001", name: "Gasoil — litre", category_id: 4, category: categories[3], type: "CARB", unit_id: 4, unit: units[3], sale_price: 890, purchase_price: 780, margin: 110, margin_percent: 14.1, stock_quantity: 5200, reserved_quantity: 0, available_quantity: 5200, min_stock: 1000, image_url: null },
  { id: 10, reference: "NRJ-002", name: "Essence — litre", category_id: 4, category: categories[3], type: "CARB", unit_id: 4, unit: units[3], sale_price: 990, purchase_price: 870, margin: 120, margin_percent: 13.8, stock_quantity: 3100, reserved_quantity: 0, available_quantity: 3100, min_stock: 800, image_url: null },
];

const clients: Client[] = [
  { id: 1, company_name: "SOTRAC BTP SARL", contact_name: "Moussa Diop", phone: "77 555 10 20", email: "contact@sotrac.sn", address: "Zone industrielle, Rufisque", zone_id: 3, zone: zones[2], client_type: "ENTREPRISE", status: "ACTIF", chantiers_count: 2, orders_count: 4, created_at: daysAgo(210) },
  { id: 2, company_name: "Ets Ndiaye & Fils", contact_name: "Awa Ndiaye", phone: "76 210 44 87", email: "ndiaye.fils@gmail.com", address: "Marché Tilène, Dakar", zone_id: 1, zone: zones[0], client_type: "ENTREPRISE", status: "ACTIF", chantiers_count: 1, orders_count: 3, created_at: daysAgo(160) },
  { id: 3, company_name: "Amadou Fall", contact_name: "Amadou Fall", phone: "70 900 12 34", email: "", address: "Parcelles Assainies U14", zone_id: 2, zone: zones[1], client_type: "PARTICULIER", status: "ACTIF", chantiers_count: 1, orders_count: 2, created_at: daysAgo(90) },
  { id: 4, company_name: "Groupe CSE Immobilier", contact_name: "Fatou Sarr", phone: "77 800 65 43", email: "achats@cse.sn", address: "Almadies, Dakar", zone_id: 1, zone: zones[0], client_type: "ENTREPRISE", status: "ACTIF", chantiers_count: 2, orders_count: 5, created_at: daysAgo(300) },
  { id: 5, company_name: "Bintou Construction", contact_name: "Bintou Kane", phone: "78 456 78 90", email: "bintou.const@outlook.com", address: "Thiès Plateau", zone_id: 4, zone: zones[3], client_type: "ENTREPRISE", status: "INACTIF", chantiers_count: 1, orders_count: 1, created_at: daysAgo(400) },
];

const chantiers: Chantier[] = [
  { id: 1, client_id: 1, client: clients[0], name: "Immeuble R+6 — Diamniadio", address: "Diamniadio, lot 42", zone_id: 3, zone: zones[2], latitude: 14.7167, longitude: -17.1833, manager_name: "Ibrahima Sow", manager_phone: "77 111 22 33", status: "ACTIF", created_at: daysAgo(120) },
  { id: 2, client_id: 1, client: clients[0], name: "Entrepôt logistique — Rufisque", address: "ZI Rufisque", zone_id: 3, zone: zones[2], latitude: 14.716, longitude: -17.27, manager_name: "Ibrahima Sow", manager_phone: "77 111 22 33", status: "ACTIF", created_at: daysAgo(80) },
  { id: 3, client_id: 2, client: clients[1], name: "Villa duplex — Sacré-Cœur", address: "Sacré-Cœur 3, Dakar", zone_id: 1, zone: zones[0], latitude: 14.73, longitude: -17.46, manager_name: "Awa Ndiaye", manager_phone: "76 210 44 87", status: "ACTIF", created_at: daysAgo(60) },
  { id: 4, client_id: 3, client: clients[2], name: "Extension maison — Parcelles", address: "Parcelles U14", zone_id: 2, zone: zones[1], latitude: 14.764, longitude: -17.431, manager_name: null, manager_phone: null, status: "ACTIF", created_at: daysAgo(30) },
  { id: 5, client_id: 4, client: clients[3], name: "Résidence Les Almadies", address: "Almadies, Dakar", zone_id: 1, zone: zones[0], latitude: 14.739, longitude: -17.52, manager_name: "Fatou Sarr", manager_phone: "77 800 65 43", status: "ACTIF", created_at: daysAgo(200) },
  { id: 6, client_id: 4, client: clients[3], name: "Showroom — VDN", address: "VDN, Dakar", zone_id: 1, zone: zones[0], latitude: 14.745, longitude: -17.47, manager_name: "Fatou Sarr", manager_phone: "77 800 65 43", status: "INACTIF", created_at: daysAgo(320) },
];

const suppliers: Supplier[] = [
  { id: 1, name: "SOCOCIM Industries", contact_name: "Service commercial", phone: "33 839 60 00", email: "ventes@sococim.sn", address: "Rufisque", purchases_count: 6, status: "ACTIF" },
  { id: 2, name: "Dangote Cement Sénégal", contact_name: "Cheikh Ba", phone: "33 855 12 12", email: "contact@dangote.sn", address: "Pout", purchases_count: 4, status: "ACTIF" },
  { id: 3, name: "Siderurgie Sahel", contact_name: "Omar Ly", phone: "77 654 32 10", email: "oly@sidersahel.com", address: "Dakar Port", purchases_count: 3, status: "ACTIF" },
];

const taxes: Tax[] = [
  { id: 1, name: "TVA 18 %", type: "TVA", rate: 0.18, is_default: true, status: "ACTIF" },
  { id: 2, name: "TPS 2 %", type: "TPS", rate: 0.02, is_default: false, status: "ACTIF" },
  { id: 3, name: "Exonéré", type: "AUCUNE", rate: 0, is_default: false, status: "ACTIF" },
];

const users: User[] = [
  { id: 1, name: "Super Admin G7", email: "superadmin@g7energy.com", code: "40000004", role: "SUPERADMIN", permissions: [], is_admin: true },
  { id: 2, name: "Admin G7", email: "admin@g7energy.com", code: "10000001", role: "ADMIN", permissions: [], is_admin: true },
  { id: 3, name: "Caissier G7", email: "caisse@g7energy.com", code: "20000002", role: "CAISSIER", permissions: [], is_admin: false },
  { id: 4, name: "Direction G7", email: "direction@g7energy.com", code: "30000003", role: "DIRECTION", permissions: [], is_admin: false },
];

const drivers: Driver[] = [
  { id: 1, user_id: null, name: "Modou Gueye", phone: "77 345 21 09", license_number: "SN-2015-8842", status: "EN_MISSION" },
  { id: 2, user_id: null, name: "Serigne Mbaye", phone: "76 908 11 22", license_number: "SN-2018-1120", status: "DISPONIBLE" },
  { id: 3, user_id: null, name: "Aliou Ndao", phone: "70 456 78 12", license_number: null, status: "INDISPONIBLE" },
];

const vehicles: Vehicle[] = [
  { id: 1, plate: "DK-4521-A", model: "Camion benne 10 t", capacity: "10 tonnes", status: "EN_MISSION" },
  { id: 2, plate: "DK-7788-B", model: "Camion plateau 15 t", capacity: "15 tonnes", status: "DISPONIBLE" },
  { id: 3, plate: "TH-2210-C", model: "Fourgon 3,5 t", capacity: "3,5 tonnes", status: "MAINTENANCE" },
];

// Barème : prix concurrent / prix vente G-E7G / PU usine HT, par produit et zone.
const prices: Price[] = [
  // FCV et Moanda
  { id: 1, product_id: 4, product: products[3], zone_id: 1, zone: zones[0], competitor_price: 3500, amount: 3300, factory_price: 2800 },
  { id: 2, product_id: 5, product: products[4], zone_id: 1, zone: zones[0], competitor_price: 6000, amount: 5500, factory_price: 4600 },
  { id: 3, product_id: 6, product: products[5], zone_id: 1, zone: zones[0], competitor_price: 8000, amount: 7500, factory_price: 6250 },
  { id: 4, product_id: 1, product: products[0], zone_id: 1, zone: zones[0], competitor_price: 123000, amount: 105000, factory_price: 77000 },
  // Oyem
  { id: 5, product_id: 4, product: products[3], zone_id: 2, zone: zones[1], competitor_price: 3500, amount: 3300, factory_price: 2800 },
  { id: 6, product_id: 5, product: products[4], zone_id: 2, zone: zones[1], competitor_price: 5500, amount: 4800, factory_price: 4600 },
  { id: 7, product_id: 6, product: products[5], zone_id: 2, zone: zones[1], competitor_price: 7500, amount: 7100, factory_price: 6250 },
  { id: 8, product_id: 1, product: products[0], zone_id: 2, zone: zones[1], competitor_price: 105000, amount: 95000, factory_price: 77000 },
  // Libreville
  { id: 9, product_id: 4, product: products[3], zone_id: 3, zone: zones[2], competitor_price: 3200, amount: 3000, factory_price: 2800 },
  { id: 10, product_id: 5, product: products[4], zone_id: 3, zone: zones[2], competitor_price: 5000, amount: 4800, factory_price: 4600 },
  { id: 11, product_id: 6, product: products[5], zone_id: 3, zone: zones[2], competitor_price: 7350, amount: 7000, factory_price: 6250 },
  { id: 12, product_id: 1, product: products[0], zone_id: 3, zone: zones[2], competitor_price: 90000, amount: 88000, factory_price: 77000 },
];

const purchases: Purchase[] = [
  { id: 1, number: "ACH-2026-0001", supplier_id: 1, supplier: suppliers[0], date: daysAgo(12), status: "RECU", total: 3900000, items: [{ id: 1, product_id: 1, product: products[0], quantity: 1000, received_quantity: 1000, unit_price: 3900 }] },
  { id: 2, number: "ACH-2026-0002", supplier_id: 3, supplier: suppliers[2], date: daysAgo(6), status: "RECU_PARTIEL", total: 5400000, items: [{ id: 2, product_id: 4, product: products[3], quantity: 2000, received_quantity: 1200, unit_price: 2700 }] },
  { id: 3, number: "ACH-2026-0003", supplier_id: 2, supplier: suppliers[1], date: daysAgo(2), status: "COMMANDE", total: 2880000, items: [{ id: 3, product_id: 2, product: products[1], quantity: 800, received_quantity: 0, unit_price: 3600 }] },
  { id: 4, number: "ACH-2026-0004", supplier_id: 1, supplier: suppliers[0], date: now(), status: "BROUILLON", total: 0, items: [] },
];

const orders: Order[] = [
  { id: 1, number: "CMD-2026-0001", client_id: 1, client: clients[0], chantier_id: 1, chantier: chantiers[0], status: "LIVREE", subtotal: 4500000, tax_amount: 810000, total: 5310000, note: null, requested_date: daysAgo(10), created_at: daysAgo(14), items: [{ id: 1, product_id: 1, product: products[0], quantity: 1000, delivered_quantity: 1000, unit_price: 4500, total: 4500000 }] },
  { id: 2, number: "CMD-2026-0002", client_id: 4, client: clients[3], chantier_id: 5, chantier: chantiers[4], status: "EN_LIVRAISON", subtotal: 960000, tax_amount: 172800, total: 1132800, note: "Livrer avant 10h", requested_date: daysAhead(1), created_at: daysAgo(3), items: [{ id: 2, product_id: 4, product: products[3], quantity: 300, delivered_quantity: 0, unit_price: 3200, total: 960000 }] },
  { id: 3, number: "CMD-2026-0003", client_id: 2, client: clients[1], chantier_id: 3, chantier: chantiers[2], status: "PRETE", subtotal: 140000, tax_amount: 25200, total: 165200, note: null, requested_date: daysAhead(2), created_at: daysAgo(2), items: [{ id: 3, product_id: 7, product: products[6], quantity: 10, delivered_quantity: 0, unit_price: 14000, total: 140000 }] },
  { id: 4, number: "CMD-2026-0004", client_id: 3, client: clients[2], chantier_id: 4, chantier: chantiers[3], status: "EN_ATTENTE", subtotal: 84000, tax_amount: 15120, total: 99120, note: null, requested_date: null, created_at: daysAgo(1), items: [{ id: 4, product_id: 2, product: products[1], quantity: 20, delivered_quantity: 0, unit_price: 4200, total: 84000 }] },
  { id: 5, number: "CMD-2026-0005", client_id: 4, client: clients[3], chantier_id: 5, chantier: chantiers[4], status: "EN_PREPARATION", subtotal: 267000, tax_amount: 48060, total: 315060, note: null, requested_date: daysAhead(3), created_at: daysAgo(1), items: [{ id: 5, product_id: 9, product: products[8], quantity: 300, delivered_quantity: 0, unit_price: 890, total: 267000 }] },
  { id: 6, number: "CMD-2026-0006", client_id: 1, client: clients[0], chantier_id: 2, chantier: chantiers[1], status: "EN_ATTENTE", subtotal: 1220000, tax_amount: 219600, total: 1439600, note: "Appeler le chef de chantier à l'arrivée", requested_date: daysAhead(5), created_at: now(), items: [{ id: 6, product_id: 5, product: products[4], quantity: 200, delivered_quantity: 0, unit_price: 6100, total: 1220000 }] },
];

const missions: Mission[] = [
  { id: 1, number: "MIS-2026-0001", order_id: 1, order: orders[0], driver_id: 1, driver: drivers[0], vehicle_id: 1, vehicle: vehicles[0], scheduled_at: daysAgo(10), started_at: daysAgo(10), arrived_at: daysAgo(10), completed_at: daysAgo(10), status: "TERMINEE" },
  { id: 2, number: "MIS-2026-0002", order_id: 2, order: orders[1], driver_id: 1, driver: drivers[0], vehicle_id: 1, vehicle: vehicles[1], scheduled_at: now(), started_at: now(), arrived_at: null, completed_at: null, status: "EN_LIVRAISON", last_location: { id: 1, latitude: 14.705, longitude: -17.44, speed: 42, recorded_at: now() }, locations: [
    { id: 1, latitude: 14.6928, longitude: -17.4467, speed: 0, recorded_at: daysAgo(0.02) },
    { id: 2, latitude: 14.7, longitude: -17.445, speed: 35, recorded_at: daysAgo(0.01) },
    { id: 3, latitude: 14.705, longitude: -17.44, speed: 42, recorded_at: now() },
  ] },
  { id: 3, number: "MIS-2026-0003", order_id: 3, order: orders[2], driver_id: 2, driver: drivers[1], vehicle_id: 2, vehicle: vehicles[1], scheduled_at: daysAhead(1), started_at: null, arrived_at: null, completed_at: null, status: "AFFECTEE" },
];
orders[1].mission = missions[1];
orders[2].mission = missions[2];

const deliveries: Delivery[] = [
  { id: 1, mission_id: 1, mission: missions[0], order_id: 1, order: orders[0], chantier_id: 1, chantier: chantiers[0], delivered_at: daysAgo(10), latitude: 14.7167, longitude: -17.1833, is_partial: false, status: "RECEPTION_CONFIRMEE", items: [{ id: 1, product_id: 1, product: products[0], planned_quantity: 1000, delivered_quantity: 1000 }], signatures: [{ id: 1, type: "CLIENT", signer_name: "Ibrahima Sow", image_url: "", signed_at: daysAgo(10) }] },
  { id: 2, mission_id: 2, mission: missions[1], order_id: 2, order: orders[1], chantier_id: 5, chantier: chantiers[4], delivered_at: now(), latitude: null, longitude: null, is_partial: true, status: "LIVREE", items: [{ id: 2, product_id: 4, product: products[3], planned_quantity: 300, delivered_quantity: 200 }] },
];

const siteStocks: SiteStock[] = [
  { chantier_id: 1, chantier: chantiers[0], product_id: 1, product: products[0], delivered: 1000, consumed: 640, remaining: 360 },
  { chantier_id: 5, chantier: chantiers[4], product_id: 4, product: products[3], delivered: 200, consumed: 50, remaining: 150 },
  { chantier_id: 3, chantier: chantiers[2], product_id: 7, product: products[6], delivered: 10, consumed: 2, remaining: 8 },
];

const consumptions: Consumption[] = [
  { id: 1, chantier_id: 1, chantier: chantiers[0], product_id: 1, product: products[0], quantity: 40, date: daysAgo(2), comment: "Coulage dalle R+2", user: { id: 4, name: "Moussa Diop" } },
  { id: 2, chantier_id: 1, chantier: chantiers[0], product_id: 1, product: products[0], quantity: 60, date: daysAgo(5), comment: null, user: { id: 4, name: "Moussa Diop" } },
  { id: 3, chantier_id: 5, chantier: chantiers[4], product_id: 4, product: products[3], quantity: 50, date: daysAgo(1), comment: "Ferraillage poteaux", user: { id: 3, name: "Direction G7" } },
];

const stockMovements: StockMovement[] = [
  { id: 1, product_id: 1, product: products[0], type: "ENTREE", quantity: 1000, balance_after: 1240, reference_type: "Purchase", reference_id: 1, reference_number: "ACH-2026-0001", note: "Réception achat", user: { id: 1, name: "Admin G7" }, created_at: daysAgo(12) },
  { id: 2, product_id: 1, product: products[0], type: "LIVRAISON", quantity: -1000, balance_after: 240, reference_type: "Delivery", reference_id: 1, reference_number: "CMD-2026-0001", note: null, user: { id: 5, name: "Modou Gueye" }, created_at: daysAgo(10) },
  { id: 3, product_id: 4, product: products[3], type: "RESERVATION", quantity: -300, balance_after: 2100, reference_type: "Order", reference_id: 2, reference_number: "CMD-2026-0002", note: null, user: { id: 1, name: "Admin G7" }, created_at: daysAgo(3) },
  { id: 4, product_id: 9, product: products[8], type: "VENTE", quantity: -120, balance_after: 5200, reference_type: "PosSale", reference_id: 1, reference_number: "VNT-2026-0001", note: null, user: { id: 2, name: "Caissier G7" }, created_at: daysAgo(1) },
];

const invoices: Invoice[] = [
  { id: 1, number: "FAC-2026-0001", type: "FACTURE", client_id: 1, client: clients[0], chantier_id: 1, chantier: chantiers[0], order_id: 1, pos_sale_id: null, date: daysAgo(9), subtotal: 4500000, tax_type: "TVA", tax_rate: 0.18, tax_amount: 810000, total: 5310000, paid_amount: 5310000, status: "PAYEE", items: [{ id: 1, product_id: 1, product: products[0], description: "Ciment CPJ 45 — sac 50 kg", quantity: 1000, unit_price: 4500, total: 4500000 }], payments: [{ id: 1, amount: 5310000, method: "VIREMENT", reference: "TRF-88412", paid_at: daysAgo(7) }] },
  { id: 2, number: "FAC-2026-0002", type: "FACTURE", client_id: 4, client: clients[3], chantier_id: 5, chantier: chantiers[4], order_id: 2, pos_sale_id: null, date: daysAgo(2), subtotal: 960000, tax_type: "TVA", tax_rate: 0.18, tax_amount: 172800, total: 1132800, paid_amount: 500000, status: "PARTIELLEMENT_PAYEE", items: [{ id: 2, product_id: 4, product: products[3], description: "Fer à béton Ø8 — barre 12 m", quantity: 300, unit_price: 3200, total: 960000 }], payments: [{ id: 2, amount: 500000, method: "MOBILE_MONEY", reference: "OM-99213", paid_at: daysAgo(1) }] },
  { id: 3, number: "TCK-2026-0001", type: "TICKET", client_id: null, client: null, chantier_id: null, chantier: null, order_id: null, pos_sale_id: 1, date: daysAgo(1), subtotal: 106800, tax_type: "TVA", tax_rate: 0.18, tax_amount: 19224, total: 126024, paid_amount: 126024, status: "PAYEE", items: [{ id: 3, product_id: 9, product: products[8], description: "Gasoil — litre", quantity: 120, unit_price: 890, total: 106800 }], payments: [{ id: 3, amount: 126024, method: "ESPECES", reference: null, paid_at: daysAgo(1) }] },
];

const posSales: PosSale[] = [
  { id: 1, number: "VNT-2026-0001", cashier: { id: 2, name: "Caissier G7" }, customer_name: "Client comptoir", subtotal: 106800, tax_type: "TVA", tax_rate: 0.18, tax_amount: 19224, total: 126024, payment_method: "ESPECES", status: "PAYEE", invoice: invoices[2], items: [{ product: products[8], quantity: 120, unit_price: 890, total: 106800 }], created_at: daysAgo(1) },
  { id: 2, number: "VNT-2026-0002", cashier: { id: 2, name: "Caissier G7" }, customer_name: null, subtotal: 9000, tax_type: "TVA", tax_rate: 0.18, tax_amount: 1620, total: 10620, payment_method: "MOBILE_MONEY", status: "PAYEE", items: [{ product: products[0], quantity: 2, unit_price: 4500, total: 9000 }], created_at: now() },
];

const notifications: Notification[] = [
  { id: "n1", type: "STOCK_BAS", title: "Stock bas — Fer Ø12", message: "Le stock de « Fer à béton Ø12 » est sous le seuil (60 < 300).", link: "/stock", read_at: null, created_at: daysAgo(0.1) },
  { id: "n2", type: "COMMANDE", title: "Nouvelle commande CMD-2026-0006", message: "SOTRAC BTP SARL a passé une commande de 1 439 600 F.", link: "/commandes/6", read_at: null, created_at: daysAgo(0.2) },
  { id: "n3", type: "LIVRAISON", title: "Livraison partielle", message: "La livraison #2 a été enregistrée comme partielle.", link: "/livraisons/2", read_at: daysAgo(1), created_at: daysAgo(1) },
  { id: "n4", type: "PAIEMENT", title: "Paiement reçu — FAC-2026-0002", message: "Paiement de 500 000 F par mobile money.", link: "/factures/2", read_at: daysAgo(1), created_at: daysAgo(1) },
];

const auditLogs: AuditLog[] = [
  { id: 1, user: { id: 1, name: "Admin G7" }, action: "order.validate", subject_type: "Order", subject_id: 2, subject_label: "CMD-2026-0002", ip: "197.149.22.10", old_values: { status: "EN_ATTENTE" }, new_values: { status: "VALIDEE" }, created_at: daysAgo(3) },
  { id: 2, user: { id: 2, name: "Caissier G7" }, action: "pos.sale", subject_type: "PosSale", subject_id: 1, subject_label: "VNT-2026-0001", ip: "197.149.22.15", old_values: null, new_values: { total: 126024 }, created_at: daysAgo(1) },
  { id: 3, user: { id: 1, name: "Admin G7" }, action: "price.update", subject_type: "Price", subject_id: 1, subject_label: "Ciment CPJ 45", ip: "197.149.22.10", old_values: { amount: 4400 }, new_values: { amount: 4500 }, created_at: daysAgo(15) },
  { id: 4, user: { id: 5, name: "Modou Gueye" }, action: "delivery.create", subject_type: "Delivery", subject_id: 1, subject_label: "Livraison #1", ip: "197.149.30.8", old_values: null, new_values: { delivered: 1000 }, created_at: daysAgo(10) },
];

/* ------------------------------ Collections ----------------------------- */

const DB: Record<string, any[]> = {
  zones, categories, units, "product-types": productTypes, products, prices,
  clients, chantiers, suppliers, purchases, orders, drivers, vehicles,
  missions, deliveries, "site-stocks": siteStocks, consumptions,
  "stock-movements": stockMovements, stocks: products, taxes, users,
  invoices, "pos/products": products, "pos/sales": posSales,
  notifications, "audit-logs": auditLogs,
};

const SEARCH_KEYS = ["name", "company_name", "number", "reference", "plate", "title", "message", "contact_name", "phone", "email", "action", "subject_label"];

function applyParams(rows: any[], params: Record<string, any> = {}) {
  let out = [...rows];
  const { search, sort, dir, page, per_page, ...filters } = params;
  if (search) {
    const s = String(search).toLowerCase();
    out = out.filter((r) => SEARCH_KEYS.some((k) => typeof r[k] === "string" && r[k].toLowerCase().includes(s)));
  }
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === "") continue;
    const values = String(v).split(",");
    out = out.filter((r) => values.includes(String(r[k])));
  }
  if (sort) out.sort((a, b) => String(a[sort] ?? "").localeCompare(String(b[sort] ?? "")) * (dir === "desc" ? -1 : 1));
  return out;
}

function paginate(rows: any[], params: Record<string, any> = {}) {
  const perPage = Number(params.per_page) || 15;
  const page = Number(params.page) || 1;
  const total = rows.length;
  const last = Math.max(1, Math.ceil(total / perPage));
  const data = rows.slice((page - 1) * perPage, page * perPage);
  return {
    data,
    meta: {
      current_page: page, last_page: last, per_page: perPage, total,
      from: total ? (page - 1) * perPage + 1 : null,
      to: total ? Math.min(page * perPage, total) : null,
    },
  };
}

const nextId = (rows: any[]) => rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;

/* --------------------------- Statistiques ------------------------------- */

function dashboard() {
  const revenue = orders.reduce((s, o) => s + o.total, 0) + posSales.reduce((s, v) => s + v.total, 0);
  return {
    revenue,
    revenue_trend: 12.4,
    orders_count: orders.length,
    pending_orders: orders.filter((o) => o.status === "EN_ATTENTE").length,
    deliveries_in_progress: missions.filter((m) => ["DEPART", "EN_LIVRAISON", "ARRIVEE"].includes(m.status)).length,
    deliveries_completed: deliveries.length,
    low_stock: products.filter((p) => p.stock_quantity > 0 && p.stock_quantity < p.min_stock).length,
    out_of_stock: products.filter((p) => p.stock_quantity <= 0).length,
    pos_sales: posSales.reduce((s, v) => s + v.total, 0),
    purchases: purchases.reduce((s, p) => s + p.total, 0),
    expenses: purchases.reduce((s, p) => s + p.total, 0),
    alerts: [
      { level: "danger", message: "Rupture de stock : Gravier concassé 5/15", link: "/stock" },
      { level: "warning", message: "2 produits sous le seuil minimal", link: "/stock" },
      { level: "info", message: "2 commandes en attente de validation", link: "/commandes" },
    ],
    recent_activity: auditLogs.slice(0, 5),
    sales_series: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((label, i) => ({
      label, revenue: 800000 + i * 150000 + (i % 3) * 220000, orders: 2 + (i % 4),
    })),
    top_products: [
      { name: "Ciment CPJ 45", value: 4500000 },
      { name: "Fer à béton Ø8", value: 960000 },
      { name: "Gasoil", value: 373800 },
      { name: "Sable de dunes", value: 140000 },
    ],
  };
}

const logisticsStats = () => ({
  to_prepare: orders.filter((o) => o.status === "VALIDEE" || o.status === "EN_PREPARATION").length,
  ready: orders.filter((o) => o.status === "PRETE").length,
  to_assign: orders.filter((o) => o.status === "PRETE" && !o.mission).length,
  in_progress: missions.filter((m) => ["DEPART", "EN_LIVRAISON", "ARRIVEE"].includes(m.status)).length,
  completed: missions.filter((m) => m.status === "TERMINEE").length,
  awaiting_reception: deliveries.filter((d) => d.status === "LIVREE").length,
});

const report = (params: any) => ({
  period: { from: params?.from ?? daysAgo(30).slice(0, 10), to: params?.to ?? now().slice(0, 10) },
  sales: ["S1", "S2", "S3", "S4"].map((label, i) => ({ label, orders: 1200000 + i * 300000, pos: 180000 + i * 40000 })),
  totals: { orders_revenue: 5310000 + 1132800, pos_revenue: 136644, purchases: 12680000, margin: 1240000, margin_percent: 19.2 },
  top_products: [
    { name: "Ciment CPJ 45", quantity: 1000, revenue: 4500000, unit: "sac" },
    { name: "Fer à béton Ø8", quantity: 300, revenue: 960000, unit: "br" },
    { name: "Gasoil", quantity: 420, revenue: 373800, unit: "L" },
  ],
  top_clients: [
    { name: "SOTRAC BTP SARL", orders: 4, revenue: 5310000 },
    { name: "Groupe CSE Immobilier", orders: 5, revenue: 1447860 },
    { name: "Ets Ndiaye & Fils", orders: 3, revenue: 165200 },
  ],
  deliveries: { completed: 1, partial: 1, on_time_rate: 92 },
});

/* ------------------------------ Actions --------------------------------- */

function handleAction(resource: string, id: string, action: string, body: any): any {
  const rows = DB[resource] ?? [];
  const item = rows.find((r) => String(r.id) === id);
  if (resource === "orders" && item) {
    if (action === "validate") item.status = "VALIDEE";
    if (action === "refuse") item.status = "REFUSEE";
    if (action === "prepare") item.status = "EN_PREPARATION";
    if (action === "ready") item.status = "PRETE";
    if (action === "assign-driver") {
      const m: Mission = {
        id: nextId(missions), number: `MIS-2026-${String(nextId(missions)).padStart(4, "0")}`,
        order_id: item.id, order: item, driver_id: body?.driver_id ?? drivers[0].id,
        driver: drivers.find((d) => d.id === (body?.driver_id ?? drivers[0].id)),
        vehicle_id: body?.vehicle_id ?? null,
        vehicle: vehicles.find((v) => v.id === body?.vehicle_id),
        scheduled_at: now(), started_at: null, arrived_at: null, completed_at: null, status: "AFFECTEE",
      };
      missions.push(m);
      item.mission = m;
    }
    return { data: item };
  }
  if (resource === "missions" && item) {
    if (action === "depart") { item.status = "DEPART"; item.started_at = now(); }
    if (action === "arrive") { item.status = "ARRIVEE"; item.arrived_at = now(); }
    return { data: item };
  }
  if (resource === "deliveries" && item && action === "confirm-reception") {
    item.status = "RECEPTION_CONFIRMEE";
    const o = orders.find((x) => x.id === item.order_id);
    if (o) o.status = "RECEPTION_CONFIRMEE";
    return { data: item };
  }
  if (resource === "purchases" && item && action === "receive") {
    item.status = "RECU";
    item.items?.forEach((it: any) => {
      const qty = Number(body?.items?.find?.((b: any) => b.item_id === it.id)?.quantity ?? it.quantity) || it.quantity;
      it.received_quantity = qty;
      const p = products.find((x) => x.id === it.product_id);
      if (p) {
        p.stock_quantity += qty;
        p.available_quantity = p.stock_quantity - p.reserved_quantity;
        stockMovements.push({
          id: nextId(stockMovements), product_id: p.id, product: p, type: "ENTREE",
          quantity: qty, balance_after: p.stock_quantity,
          reference_type: "Purchase", reference_id: item.id, reference_number: item.number,
          note: "Réception achat", user: { id: 1, name: "Admin G7" }, created_at: now(),
        });
      }
    });
    return { data: item };
  }
  if (resource === "invoices" && item && action === "payments") {
    const amount = Number(body?.amount) || 0;
    item.payments = item.payments ?? [];
    item.payments.push({ id: nextId(item.payments), amount, method: body?.method ?? "ESPECES", reference: body?.reference ?? null, paid_at: now() });
    item.paid_amount += amount;
    item.status = item.paid_amount >= item.total ? "PAYEE" : "PARTIELLEMENT_PAYEE";
    return { data: item };
  }
  if (resource === "notifications") {
    if (action === "read" && item) item.read_at = now();
    return { data: item ?? {} };
  }
  return { data: item ?? {} };
}

/* ------------------------------ Adaptateur ------------------------------ */

const ok = (config: AxiosRequestConfig, data: any, status = 200): AxiosResponse => ({
  data, status, statusText: "OK", headers: {}, config: config as any,
});

export async function mockAdapter(config: AxiosRequestConfig): Promise<AxiosResponse> {
  await new Promise((r) => setTimeout(r, 150 + Math.random() * 250));
  const method = (config.method ?? "get").toLowerCase();
  const url = (config.url ?? "").replace(/^\/+/, "");
  const params = (config.params ?? {}) as Record<string, any>;
  const body = typeof config.data === "string" ? JSON.parse(config.data || "{}") : config.data;
  const seg = url.split("/").filter(Boolean);

  // Endpoints spéciaux
  if (method === "get" && url === "dashboard") return ok(config, { data: dashboard() });
  if (method === "get" && url === "logistics/stats") return ok(config, { data: logisticsStats() });
  if (method === "get" && url === "reports/overview") return ok(config, { data: report(params) });
  if (method === "get" && url === "reports/export")
    return ok(config, new Blob(["produit;quantite;revenu\nCiment CPJ 45;1000;4500000\n"], { type: "text/csv" }));
  if (method === "get" && /^invoices\/\d+\/pdf$/.test(url))
    return ok(config, new Blob(["%PDF-1.4 mock"], { type: "application/pdf" }));
  if (method === "post" && url === "notifications/read-all") {
    notifications.forEach((n) => (n.read_at = n.read_at ?? now()));
    return ok(config, { data: {} });
  }

  // Actions : POST /resource/:id/action
  if (method === "post" && seg.length === 3 && /^\d+$/.test(seg[1])) {
    return ok(config, handleAction(seg[0], seg[1], seg[2], body));
  }

  // Résolution de la collection : clé complète (ex. "pos/products"),
  // clé à deux segments pour un détail (ex. "pos/sales/1"), puis premier segment.
  const twoSeg = seg.slice(0, 2).join("/");
  const collKey = DB[url] ? url : DB[twoSeg] && seg.length === 3 ? twoSeg : seg[0];
  const rows = DB[collKey];
  const idSeg = collKey === twoSeg && seg.length === 3 ? seg[2] : seg[1];
  const isDetail = !DB[url] && (seg.length === 2 || (collKey === twoSeg && seg.length === 3));
  if (!rows) return ok(config, { data: isDetail ? {} : paginate([], params) });

  // GET /resource/:id
  if (method === "get" && isDetail) {
    const item = rows.find((r) => String(r.id ?? r[`${collKey.slice(0, -1)}_id`]) === idSeg);
    return ok(config, { data: item ?? null }, item ? 200 : 404);
  }
  // GET /resource
  if (method === "get") return ok(config, paginate(applyParams(rows, params), params));
  // POST /resource
  if (method === "post" && seg.length >= 1 && !isDetail) {
    const item = { id: nextId(rows), ...body, created_at: now() };
    if (collKey === "pos/sales") {
      item.number = `VNT-2026-${String(item.id).padStart(4, "0")}`;
      item.status = "PAYEE";
      item.cashier = { id: 2, name: "Caissier G7" };
    }
    if (collKey === "deliveries") { item.status = "LIVREE"; item.delivered_at = now(); }
    rows.push(item);
    return ok(config, { data: item }, 201);
  }
  // PUT /resource/:id
  if ((method === "put" || method === "patch") && isDetail) {
    const i = rows.findIndex((r) => String(r.id) === seg[1]);
    if (i >= 0) rows[i] = { ...rows[i], ...body };
    return ok(config, { data: rows[i] ?? null });
  }
  // DELETE /resource/:id
  if (method === "delete" && isDetail) {
    const i = rows.findIndex((r) => String(r.id) === seg[1]);
    if (i >= 0) rows.splice(i, 1);
    return ok(config, { data: {} }, 204);
  }
  return ok(config, { data: {} });
}
