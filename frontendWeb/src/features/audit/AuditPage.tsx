import type { AuditLog } from "@/types";
import { ModuleTabs } from "@/components/ui";
import { SYSTEME_TABS } from "@/app/moduleTabs";
import { useListState, usePaginated } from "@/lib/hooks";
import { datetime } from "@/lib/format";
import { Badge, DataTable, PageHeader, SearchInput, type Column } from "@/components/ui";

export function AuditPage() {
  const list = useListState({ per_page: 30 });
  const { data, isLoading, errorMessage } = usePaginated<AuditLog>("audit", "/audit-logs", list.params);

  const columns: Column<AuditLog>[] = [
    { key: "created_at", header: "Date", render: (a) => datetime(a.created_at) },
    { key: "user", header: "Utilisateur", render: (a) => a.user?.name ?? "Système" },
    { key: "action", header: "Action", render: (a) => <Badge tone="gold">{a.action}</Badge> },
    {
      key: "subject",
      header: "Objet",
      render: (a) => (
        <span>
          <span className="font-semibold">{a.subject_label ?? `${a.subject_type}#${a.subject_id}`}</span>{" "}
          <span className="text-xs text-ge7-black/40">{a.subject_type}</span>
        </span>
      ),
    },
    { key: "ip", header: "IP", render: (a) => <span className="text-xs text-ge7-black/50">{a.ip ?? "—"}</span> },
    {
      key: "diff",
      header: "Changements",
      render: (a) =>
        a.old_values || a.new_values ? (
          <details className="text-xs">
            <summary className="cursor-pointer text-ge7-purple">voir</summary>
            <pre className="mt-1 max-w-xs overflow-auto rounded-lg bg-ge7-cream p-2">
              {JSON.stringify({ avant: a.old_values, apres: a.new_values }, null, 1)}
            </pre>
          </details>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <>
      <ModuleTabs tabs={SYSTEME_TABS} />
      <PageHeader
        title="Journal d'audit"
        subtitle="Traçabilité complète des actions réalisées sur la plateforme."
        breadcrumb="Système"
      />
      <div className="mb-4 max-w-sm">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="Action, objet, utilisateur…" />
      </div>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        error={errorMessage}
        rowKey={(a) => a.id}
        page={list.page}
        onPageChange={list.setPage}
        dense
        emptyTitle="Aucune entrée"
      />
    </>
  );
}
