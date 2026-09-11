import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Category, Chantier, Client, Driver, Product, Supplier, Tax, Unit, Vehicle, Zone } from "@/types";

async function all<T>(url: string, params?: Record<string, unknown>) {
  const { data } = await api.get<{ data: T[] }>(url, { params: { per_page: 500, ...params } });
  return data.data;
}

const opts = { staleTime: 5 * 60_000 };

export const useZones = () => useQuery({ queryKey: ["ref", "zones"], queryFn: () => all<Zone>("/zones"), ...opts });
export const useCategories = () => useQuery({ queryKey: ["ref", "categories"], queryFn: () => all<Category>("/categories"), ...opts });
export const useUnits = () => useQuery({ queryKey: ["ref", "units"], queryFn: () => all<Unit>("/units"), ...opts });
export const useTaxes = () => useQuery({ queryKey: ["ref", "taxes"], queryFn: () => all<Tax>("/taxes"), ...opts });
export const useSuppliersRef = () => useQuery({ queryKey: ["ref", "suppliers"], queryFn: () => all<Supplier>("/suppliers", { status: "ACTIF" }), ...opts });
export const useClientsRef = () => useQuery({ queryKey: ["ref", "clients"], queryFn: () => all<Client>("/clients", { status: "ACTIF" }), ...opts });
export const useChantiersRef = (clientId?: number | null) =>
  useQuery({
    queryKey: ["ref", "chantiers", clientId ?? "all"],
    queryFn: () => all<Chantier>("/chantiers", clientId ? { client_id: clientId } : undefined),
    ...opts,
  });
export const useProductsRef = () => useQuery({ queryKey: ["ref", "products"], queryFn: () => all<Product>("/products"), ...opts });
export const useDriversRef = () => useQuery({ queryKey: ["ref", "drivers"], queryFn: () => all<Driver>("/drivers"), ...opts });
export const useVehiclesRef = () => useQuery({ queryKey: ["ref", "vehicles"], queryFn: () => all<Vehicle>("/vehicles"), ...opts });
