import axios, { AxiosError, type AxiosAdapter, type AxiosRequestConfig } from "axios";
import type { Paginated, ListParams } from "@/types";
import { mockAdapter } from "./mock";

const TOKEN_KEY = "ge7.token";

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(^|; )" + name.replace(/[\[\]\\.*+?^$|{}()]/g, "\\$&") + "=([^;]*)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function setTokenCookie(token: string): void {
  const isHttps = window.location.protocol === "https:";
  const secure = isHttps ? "Secure;" : "";
  const sameSite = isHttps ? "SameSite=None;" : "SameSite=Lax;";
  document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; Path=/; ${sameSite} ${secure} Max-Age=86400;`;
}

function clearTokenCookie(): void {
  document.cookie = `${TOKEN_KEY}=; Path=/; Max-Age=0;`;
}

export const tokenStore = {
  get: () => getCookie(TOKEN_KEY),
  set: (t: string) => setTokenCookie(t),
  clear: () => clearTokenCookie(),
};

const selectiveAdapter: AxiosAdapter = (config) => {
  const path = (config.url || "").replace(/^\/+/, "");
  // Ces ressources sont branchées sur l'API Laravel.
  if (path === "users" || path.startsWith("users/") || path === "zones" || path.startsWith("zones/") || path === "taxes" || path.startsWith("taxes/") || path === "suppliers" || path.startsWith("suppliers/") || path === "units" || path.startsWith("units/") || path === "categories" || path.startsWith("categories/") || path === "products" || path.startsWith("products/") || path === "prices" || path.startsWith("prices/") || path === "purchases" || path.startsWith("purchases/") || path === "stocks" || path.startsWith("stocks/") || path === "stock-movements" || path.startsWith("stock-movements/") || path === "pos" || path.startsWith("pos/") || path === "dashboard" || path.startsWith("dashboard/") || path === "audit-logs" || path.startsWith("audit-logs/")) {
    const { adapter, ...rest } = config;
    return axios.request(rest as AxiosRequestConfig);
  }
  return mockAdapter(config);
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  headers: { Accept: "application/json" },
  // Les requêtes vers ces ressources passent au backend Laravel, le reste reste en mock.
  adapter: selectiveAdapter,
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

export const authApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  headers: { Accept: "application/json" },
});

authApi.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

authApi.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      tokenStore.clear();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      tokenStore.clear();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
  status?: number;
}

export function toApiError(e: unknown): ApiError {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as Partial<ApiError> | undefined;
    return {
      message: data?.message ?? e.message ?? "Erreur réseau",
      errors: data?.errors,
      status: e.response?.status,
    };
  }
  return { message: e instanceof Error ? e.message : "Erreur inconnue" };
}

export async function getList<T>(url: string, params?: ListParams) {
  const { data } = await api.get<Paginated<T>>(url, { params });
  return data;
}

export async function getOne<T>(url: string) {
  const { data } = await api.get<{ data: T }>(url);
  return data.data;
}

export async function post<T, B = unknown>(url: string, body?: B) {
  const { data } = await api.post<{ data: T }>(url, body);
  return data.data;
}

export async function put<T, B = unknown>(url: string, body?: B) {
  const { data } = await api.put<{ data: T }>(url, body);
  return data.data;
}

export async function del(url: string) {
  await api.delete(url);
}
