import type { ReactNode } from "react";
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Inbox, Loader2 } from "lucide-react";
import type { Paginated } from "@/types";
import { Button } from "./Button";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "right" | "center";
}

interface Props<T> {
  columns: Column<T>[];
  data?: Paginated<T> | T[];
  isLoading?: boolean;
  error?: string | null;
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  page?: number;
  onPageChange?: (page: number) => void;
  sort?: { key: string; dir: "asc" | "desc" };
  onSortChange?: (sort: { key: string; dir: "asc" | "desc" }) => void;
  emptyTitle?: string;
  emptyHint?: ReactNode;
  dense?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  error,
  rowKey,
  onRowClick,
  page,
  onPageChange,
  sort,
  onSortChange,
  emptyTitle = "Aucun résultat",
  emptyHint,
  dense,
}: Props<T>) {
  const rows = Array.isArray(data) ? data : (data?.data ?? []);
  const meta = Array.isArray(data) ? undefined : data?.meta;
  const align = { left: "text-left", right: "text-right", center: "text-center" };

  const toggleSort = (key: string) => {
    if (!onSortChange) return;
    const dir = sort?.key === key && sort.dir === "asc" ? "desc" : "asc";
    onSortChange({ key, dir });
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-ge7-black/5 bg-white shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-ge7-black text-left text-xs uppercase tracking-wider text-ge7-gold-light">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-4 py-3 font-semibold ${align[c.align ?? "left"]} ${c.className ?? ""}`}
                >
                  {c.sortable && onSortChange ? (
                    <button
                      onClick={() => toggleSort(c.key)}
                      className="inline-flex items-center gap-1 hover:text-white"
                    >
                      {c.header}
                      {sort?.key === c.key ? (
                        sort.dir === "asc" ? (
                          <ArrowUp size={13} />
                        ) : (
                          <ArrowDown size={13} />
                        )
                      ) : (
                        <ArrowUpDown size={13} className="opacity-50" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ge7-black/5">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-14 text-center text-ge7-black/50">
                  <Loader2 className="mx-auto mb-2 animate-spin text-ge7-gold" />
                  Chargement…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-14 text-center text-rose-600">
                  <AlertCircle className="mx-auto mb-2" />
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-14 text-center text-ge7-black/50">
                  <Inbox className="mx-auto mb-2 text-ge7-gold" />
                  <p className="font-semibold text-ge7-black/70">{emptyTitle}</p>
                  {emptyHint && <div className="mt-1 text-xs">{emptyHint}</div>}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`${onRowClick ? "cursor-pointer" : ""} transition hover:bg-ge7-gold-soft/30`}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-4 ${dense ? "py-2" : "py-3"} ${align[c.align ?? "left"]} ${c.className ?? ""}`}
                    >
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {meta && meta.last_page > 1 && onPageChange && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ge7-black/5 px-4 py-3 text-sm text-ge7-black/60">
          <span>
            {meta.from ?? 0}–{meta.to ?? 0} sur {meta.total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={(page ?? meta.current_page) <= 1}
              onClick={() => onPageChange((page ?? meta.current_page) - 1)}
            >
              <ChevronLeft size={14} /> Précédent
            </Button>
            <span className="px-2 font-semibold text-ge7-black">
              {meta.current_page} / {meta.last_page}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={(page ?? meta.current_page) >= meta.last_page}
              onClick={() => onPageChange((page ?? meta.current_page) + 1)}
            >
              Suivant <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
