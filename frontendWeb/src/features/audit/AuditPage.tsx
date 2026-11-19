import type { AuditLog } from "@/types";
import { ModuleTabs } from "@/components/ui";
import { SYSTEME_TABS } from "@/app/moduleTabs";
import { useListState, usePaginated } from "@/lib/hooks";
import { datetime } from "@/lib/format";
import { Badge, CardGrid, PageHeader, SearchInput } from "@/components/ui";

export function AuditPage() {
  const list = useListState({ per_page: 30 });
  const { data, isLoading, errorMessage } = usePaginated<AuditLog>("audit", "/audit-logs", list.params);

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
      <CardGrid
        sansImage
        data={data}
        isLoading={isLoading}
        error={errorMessage}
        rowKey={(a) => a.id}
        page={list.page}
        onPageChange={list.setPage}
        emptyTitle="Aucune entrée"
        carte={(a) => ({
          badge: <Badge tone="gold">{a.action}</Badge>,
          titre: a.subject_label ?? `${a.subject_type}#${a.subject_id}`,
          sousTitre: a.subject_type,
          details: [
            { label: "Date", valeur: datetime(a.created_at) },
            { label: "Utilisateur", valeur: a.user?.name ?? "Système" },
            ...(a.ip ? [{ label: "IP", valeur: a.ip }] : []),
          ],
          // Changements : dépliables dans la carte, sans la faire déborder.
          pied:
            a.old_values || a.new_values ? (
              <details className="w-full min-w-0 text-xs">
                <summary className="cursor-pointer font-semibold text-ge7-purple">Voir les changements</summary>
                <pre className="mt-1 max-h-48 max-w-full overflow-auto whitespace-pre-wrap break-all rounded-lg bg-ge7-cream p-2">
                  {JSON.stringify({ avant: a.old_values, apres: a.new_values }, null, 1)}
                </pre>
              </details>
            ) : undefined,
        })}
      />
    </>
  );
}
