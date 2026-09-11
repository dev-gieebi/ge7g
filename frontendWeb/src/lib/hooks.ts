import { useCallback, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, getList, getOne, post, put, toApiError, type ApiError } from "./api";
import type { ListParams, Paginated } from "@/types";
import { useToast } from "./toast";

export function useListState(initial: Partial<ListParams> = {}) {
  const [page, setPage] = useState(1);
  const [search, setSearchRaw] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | undefined>();
  const [filters, setFiltersRaw] = useState<Record<string, string | number | undefined>>({});

  const setSearch = useCallback((v: string) => {
    setSearchRaw(v);
    setPage(1);
  }, []);
  const setFilter = useCallback((k: string, v: string | number | undefined) => {
    setFiltersRaw((f) => ({ ...f, [k]: v === "" ? undefined : v }));
    setPage(1);
  }, []);

  const params = useMemo<ListParams>(
    () => ({
      ...initial,
      page,
      search: search || undefined,
      sort: sort?.key,
      dir: sort?.dir,
      ...filters,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, search, sort, filters],
  );

  return { page, setPage, search, setSearch, sort, setSort, filters, setFilter, params };
}

export function usePaginated<T>(key: string, url: string, params: ListParams, enabled = true, refetchInterval?: number) {
  const q = useQuery<Paginated<T>, unknown>({
    queryKey: [key, params],
    queryFn: () => getList<T>(url, params),
    placeholderData: keepPreviousData,
    enabled,
    refetchInterval,
  });
  return { ...q, errorMessage: q.error ? toApiError(q.error).message : null };
}

export function useOne<T>(key: string, url: string | null) {
  return useQuery<T>({
    queryKey: [key, url],
    queryFn: () => getOne<T>(url as string),
    enabled: !!url,
  });
}

export function useCrud<T, B = Partial<T>>(key: string, url: string) {
  const qc = useQueryClient();
  const notify = useToast();
  const invalidate = () => qc.invalidateQueries({ queryKey: [key] });
  const onError = (e: unknown) => notify(toApiError(e).message, "error");

  const create = useMutation<T, ApiError, B>({
    mutationFn: (body) => post<T, B>(url, body),
    onSuccess: () => {
      invalidate();
      notify("Enregistré avec succès");
    },
    onError,
  });
  const update = useMutation<T, ApiError, { id: number | string; body: B }>({
    mutationFn: ({ id, body }) => put<T, B>(`${url}/${id}`, body),
    onSuccess: () => {
      invalidate();
      notify("Modifications enregistrées");
    },
    onError,
  });
  const remove = useMutation<void, ApiError, number | string>({
    mutationFn: (id) => del(`${url}/${id}`),
    onSuccess: () => {
      invalidate();
      notify("Supprimé");
    },
    onError,
  });
  return { create, update, remove, invalidate };
}

export function useAction<TVars = void, TRes = unknown>(
  urlFn: (vars: TVars) => string,
  opts: { keys?: string[]; success?: string; body?: (vars: TVars) => unknown } = {},
) {
  const qc = useQueryClient();
  const notify = useToast();
  return useMutation<TRes, ApiError, TVars>({
    mutationFn: (vars) => post<TRes>(urlFn(vars), opts.body?.(vars)),
    onSuccess: () => {
      opts.keys?.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      if (opts.success) notify(opts.success);
    },
    onError: (e) => notify(toApiError(e).message, "error"),
  });
}

export function fieldErrors(e: unknown): Record<string, string[]> {
  return toApiError(e).errors ?? {};
}
