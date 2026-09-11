import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCheck } from "lucide-react";
import type { Notification } from "@/types";
import { api, toApiError } from "@/lib/api";
import { useListState, usePaginated } from "@/lib/hooks";
import { datetime } from "@/lib/format";
import { Badge, Button, DataTable, PageHeader, SearchInput, type Column } from "@/components/ui";

export function NotificationsPage() {
  const list = useListState({ per_page: 20 });
  const { data, isLoading, errorMessage: err } = usePaginated<Notification>("notifications", "/notifications", list.params);
  const qc = useQueryClient();

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markAll = useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const columns: Column<Notification>[] = [
    {
      key: "title",
      header: "Notification",
      render: (n) => (
        <div className={n.read_at ? "opacity-60" : ""}>
          <p className="font-semibold">{n.title}</p>
          <p className="text-xs text-ge7-black/60">{n.message}</p>
        </div>
      ),
    },
    { key: "type", header: "Type", render: (n) => <Badge tone={n.read_at ? "gray" : "gold"}>{n.type}</Badge> },
    { key: "created_at", header: "Date", render: (n) => datetime(n.created_at) },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (n) => (
        <div className="flex justify-end gap-1">
          {n.link && (
            <Link to={n.link}>
              <Button size="sm" variant="ghost">Ouvrir</Button>
            </Link>
          )}
          {!n.read_at && (
            <Button size="sm" variant="ghost" title="Marquer comme lue" onClick={() => markRead.mutate(n.id)}>
              <CheckCheck size={14} className="text-emerald-600" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Alertes et événements de la plateforme."
        breadcrumb="Pilotage"
        action={
          <Button variant="secondary" onClick={() => markAll.mutate()} loading={markAll.isPending}>
            <CheckCheck size={16} /> Tout marquer comme lu
          </Button>
        }
      />
      {markAll.isError && <p className="mb-3 text-sm text-rose-600">{toApiError(markAll.error).message}</p>}
      <div className="mb-4 max-w-sm">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="Rechercher…" />
      </div>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        error={err}
        rowKey={(n) => n.id}
        page={list.page}
        onPageChange={list.setPage}
        emptyTitle="Aucune notification"
      />
    </>
  );
}
