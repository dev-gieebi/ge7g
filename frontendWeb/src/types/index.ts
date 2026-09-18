export type Role = "AG_LOGISTIQUE" | "CAISSIER" | "DIRECTION" | "SUPERADMIN";

export interface User {
  id: number;
  name: string;
  email: string;
  code: string;
  role: Role;
  permissions: string[];
  is_admin?: boolean;
}

export interface Paginated<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
  };
}

export interface ListParams {
  page?: number;
  per_page?: number;
  search?: string;
  sort?: string;
  dir?: "asc" | "desc";
  [key: string]: string | number | boolean | undefined;
}

export type Status = "ACTIF" | "INACTIF";

export interface Client {
  id: number;
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
  zone_id: number | null;
  zone?: Zone;
  client_type: "PARTICULIER" | "ENTREPRISE";
  status: Status;
  chantiers_count?: number;
  orders_count?: number;
  created_at: string;
}

export interface Chantier {
  id: number;
  client_id: number;
  client?: Client;
  name: string;
  address: string;
  zone_id: number | null;
  zone?: Zone;
  latitude: number | null;
  longitude: number | null;
  manager_name: string | null;
  manager_phone: string | null;
  status: Status;
  created_at: string;
}

export interface Zone {
  id: number;
  name: string;
  code: string;
  status?: Status;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  products_count?: number;
}

export interface Unit {
  id: number;
  name: string;
  symbol: string;
  decimals: number;
}

export interface ProductType {
  id: number;
  name: string;
  code: string;
  products_count?: number;
  status: Status;
}

export interface Product {
  id: number;
  reference: string;
  name: string;
  category_id: number;
  category?: Category;
  type: string | null;
  unit_id: number;
  unit?: Unit;
  sale_price: number;
  purchase_price?: number;
  margin?: number;
  margin_percent?: number;
  stock_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  min_stock: number;
  image_url: string | null;
}

export interface Price {
  id: number;
  product_id: number;
  product?: Product;
  zone_id: number | null;
  zone?: Zone;
  /** Prix pratiqué par le concurrent sur la zone. */
  competitor_price: number;
  /** Prix de vente G-E7G. */
  amount: number;
  /** Prix usine hors taxes. */
  factory_price: number;
  /** Ce prix est destiné au point de vente (caisse). */
  for_pos?: boolean;
}

export interface Supplier {
  id: number;
  name: string;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
  purchases_count?: number;
  status: Status;
}

export type PurchaseStatus = "BROUILLON" | "COMMANDE" | "RECU_PARTIEL" | "RECU" | "ANNULE";

export interface PurchaseItem {
  id: number;
  product_id: number;
  product?: Product;
  quantity: number;
  received_quantity: number;
  unit_price: number;
}

export interface Purchase {
  id: number;
  number: string;
  supplier_id: number;
  supplier?: Supplier;
  date: string;
  status: PurchaseStatus;
  total: number;
  items?: PurchaseItem[];
}

export type StockMovementType =
  | "ENTREE"
  | "SORTIE"
  | "AJUSTEMENT"
  | "RESERVATION"
  | "LIVRAISON"
  | "TRANSFERT"
  | "VENTE";

export interface StockMovement {
  id: number;
  product_id: number;
  product?: Product;
  type: StockMovementType;
  quantity: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: number | null;
  reference_number: string | null;
  note: string | null;
  user?: Pick<User, "id" | "name">;
  created_at: string;
}

export type OrderStatus =
  | "BROUILLON"
  | "EN_ATTENTE"
  | "VALIDEE"
  | "EN_PREPARATION"
  | "PRETE"
  | "EN_LIVRAISON"
  | "LIVREE"
  | "PARTIELLEMENT_LIVREE"
  | "RECEPTION_CONFIRMEE"
  | "CLOTUREE"
  | "REFUSEE"
  | "ANNULEE";

export interface OrderItem {
  id: number;
  product_id: number;
  product?: Product;
  quantity: number;
  delivered_quantity: number;
  unit_price: number;
  total: number;
}

export interface Order {
  id: number;
  number: string;
  client_id: number;
  client?: Client;
  chantier_id: number;
  chantier?: Chantier;
  status: OrderStatus;
  subtotal: number;
  tax_amount: number;
  total: number;
  note: string | null;
  requested_date: string | null;
  items?: OrderItem[];
  mission?: Mission | null;
  created_at: string;
}

export interface Driver {
  id: number;
  user_id: number | null;
  name: string;
  phone: string;
  license_number: string | null;
  status: "DISPONIBLE" | "EN_MISSION" | "INDISPONIBLE";
}

export interface Vehicle {
  id: number;
  plate: string;
  model: string;
  capacity: string | null;
  status: "DISPONIBLE" | "EN_MISSION" | "MAINTENANCE";
}

export type MissionStatus =
  | "AFFECTEE"
  | "DEPART"
  | "EN_LIVRAISON"
  | "ARRIVEE"
  | "LIVREE"
  | "TERMINEE"
  | "ANNULEE";

export interface MissionLocation {
  id: number;
  latitude: number;
  longitude: number;
  speed: number | null;
  recorded_at: string;
}

export interface Mission {
  id: number;
  number: string;
  order_id: number;
  order?: Order;
  driver_id: number;
  driver?: Driver;
  vehicle_id: number | null;
  vehicle?: Vehicle;
  scheduled_at: string;
  started_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  status: MissionStatus;
  last_location?: MissionLocation | null;
  locations?: MissionLocation[];
}

export interface Signature {
  id: number;
  type: "CLIENT";
  signer_name: string;
  image_url: string;
  signed_at: string;
}

export interface DeliveryItem {
  id: number;
  product_id: number;
  product?: Product;
  planned_quantity: number;
  delivered_quantity: number;
}

export interface Delivery {
  id: number;
  mission_id: number;
  mission?: Mission;
  order_id: number;
  order?: Order;
  chantier_id: number;
  chantier?: Chantier;
  delivered_at: string;
  latitude: number | null;
  longitude: number | null;
  is_partial: boolean;
  status: "LIVREE" | "RECEPTION_CONFIRMEE";
  items?: DeliveryItem[];
  signatures?: Signature[];
}

export interface SiteStock {
  chantier_id: number;
  chantier?: Chantier;
  product_id: number;
  product?: Product;
  delivered: number;
  consumed: number;
  remaining: number;
}

export interface Consumption {
  id: number;
  chantier_id: number;
  chantier?: Chantier;
  product_id: number;
  product?: Product;
  quantity: number;
  date: string;
  comment: string | null;
  user?: Pick<User, "id" | "name">;
}

export type TaxType = "AUCUNE" | "TVA" | "CSS" | "TPS";

export interface Tax {
  id: number;
  name: string;
  type: TaxType;
  rate: number;
  is_default: boolean;
  status?: Status;
}

export type PaymentMethod = "ESPECES" | "CARTE" | "CHEQUE" | "VIREMENT" | "MOBILE_MONEY" | "AUTRE";

export interface Payment {
  id: number;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  paid_at: string;
}

export type InvoiceStatus = "BROUILLON" | "EMISE" | "PAYEE" | "PARTIELLEMENT_PAYEE" | "ANNULEE";

export interface InvoiceItem {
  id: number;
  product_id: number;
  product?: Product;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Invoice {
  id: number;
  number: string;
  type: "FACTURE" | "AVOIR" | "TICKET";
  client_id: number | null;
  client?: Client | null;
  chantier_id: number | null;
  chantier?: Chantier | null;
  order_id: number | null;
  pos_sale_id: number | null;
  date: string;
  subtotal: number;
  tax_type: TaxType;
  tax_rate: number;
  tax_amount: number;
  total: number;
  paid_amount: number;
  status: InvoiceStatus;
  items?: InvoiceItem[];
  payments?: Payment[];
}

export interface PosProduct {
  id: number;
  reference: string;
  name: string;
  type: string | null;
  category?: Pick<Category, "id" | "name">;
  unit?: Pick<Unit, "id" | "name" | "symbol">;
  sale_price: number;
  available_quantity: number;
  image_url: string | null;
}

export interface PosSale {
  id: number;
  number: string;
  cashier?: Pick<User, "id" | "name">;
  zone_id?: number | null;
  zone?: Pick<Zone, "id" | "name"> | null;
  customer_name: string | null;
  subtotal: number;
  tax_type: TaxType;
  tax_rate: number;
  tax_amount: number;
  total: number;
  payment_method: PaymentMethod;
  status: "PAYEE" | "ANNULEE";
  delivery_status?: "LIVREE" | "PARTIELLEMENT_LIVREE" | "A_LIVRER";
  invoice?: Invoice | null;
  items?: { id: number; product?: PosProduct; quantity: number; delivered_quantity: number; remaining_quantity: number; unit_price: number; total: number }[];
  created_at: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user?: Pick<User, "id" | "name">;
  action: string;
  subject_type: string;
  subject_id: number;
  subject_label: string | null;
  ip: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
}

export interface SalesSeriesPoint {
  label: string;
  revenue: number;
  orders: number;
}

export interface DashboardStats {
  revenue: number;
  revenue_trend: number;
  orders_count: number;
  pending_orders: number;
  deliveries_in_progress: number;
  deliveries_completed: number;
  low_stock: number;
  out_of_stock: number;
  products_count: number;
  products_sold_today: number;
  online_sales: number;
  pos_sales: number;
  purchases: number;
  expenses: number;
  alerts: { level: "warning" | "danger" | "info"; message: string; link?: string }[];
  recent_activity: AuditLog[];
  sales_series: SalesSeriesPoint[];
  top_products: { name: string; value: number }[];
}

export interface LogisticsStats {
  to_prepare: number;
  ready: number;
  to_assign: number;
  in_progress: number;
  completed: number;
  awaiting_reception: number;
}
