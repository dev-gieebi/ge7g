import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export interface CartItem {
  produit_id: number;
  designation: string;
  prix: number;
  image: string | null;
  quantite: number;
}

export interface ShopZone {
  /** `null` = « Toutes les villes » (prix sans zone spécifique). */
  id: number | null;
  name: string;
}

interface CartApi {
  items: CartItem[];
  count: number;
  total: number;
  /** Ville de livraison choisie — détermine le barème affiché, comme à la caisse. */
  zone: ShopZone | null;
  setZone: (zone: ShopZone | null) => void;
  add: (item: Omit<CartItem, "quantite">, quantite: number) => void;
  setQuantite: (produitId: number, quantite: number) => void;
  remove: (produitId: number) => void;
  clear: () => void;
}

const KEY = "ge7.cart";
const ZONE_KEY = "ge7.zone";
const CartContext = createContext<CartApi | null>(null);

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(items: CartItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* stockage indisponible : le panier reste en mémoire */
  }
}

function loadZone(): ShopZone | null {
  try {
    const raw = localStorage.getItem(ZONE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && (typeof parsed.id === "number" || parsed.id === null) && typeof parsed.name === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(load);
  const [zone, setZoneState] = useState<ShopZone | null>(loadZone);

  const api = useMemo<CartApi>(() => {
    const commit = (next: CartItem[]) => {
      setItems(next);
      save(next);
    };

    return {
      items,
      count: items.reduce((s, i) => s + i.quantite, 0),
      total: items.reduce((s, i) => s + i.prix * i.quantite, 0),
      zone,
      setZone: (z) => {
        setZoneState(z);
        try {
          z ? localStorage.setItem(ZONE_KEY, JSON.stringify(z)) : localStorage.removeItem(ZONE_KEY);
        } catch {
          /* stockage indisponible */
        }
      },
      add: (item, quantite) => {
        const existing = items.find((i) => i.produit_id === item.produit_id);
        commit(
          existing
            ? items.map((i) => (i.produit_id === item.produit_id ? { ...i, quantite: i.quantite + quantite } : i))
            : [...items, { ...item, quantite }],
        );
      },
      setQuantite: (produitId, quantite) =>
        commit(quantite <= 0 ? items.filter((i) => i.produit_id !== produitId) : items.map((i) => (i.produit_id === produitId ? { ...i, quantite } : i))),
      remove: (produitId) => commit(items.filter((i) => i.produit_id !== produitId)),
      clear: () => commit([]),
    };
  }, [items, zone]);

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart doit être utilisé dans CartProvider");
  return ctx;
}
