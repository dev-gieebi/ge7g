import { useState } from "react";
import { ModuleTabs } from "@/components/ui";
import { SYSTEME_TABS } from "@/app/moduleTabs";
import { MapPin, Percent, Users } from "lucide-react";
import type { Role, Tax, User, Zone } from "@/types";
import { ROLE_LABELS } from "@/lib/rbac";
import { useAuth } from "@/lib/auth";
import { Badge, PageHeader } from "@/components/ui";
import { SimpleCrud } from "./SimpleCrud";

type Tab = "taxes" | "zones" | "users";
const TABS: { key: Tab; label: string; icon: typeof Percent }[] = [
  { key: "taxes", label: "Fiscalité", icon: Percent },
  { key: "zones", label: "Zones", icon: MapPin },
  { key: "users", label: "Utilisateurs", icon: Users },
];

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>("taxes");
  const { user } = useAuth();
  return (
    <>
      <ModuleTabs tabs={SYSTEME_TABS} />
      <PageHeader title="Paramètres" subtitle="Configuration fiscale, zones géographiques et comptes utilisateurs." breadcrumb="Système" />
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${tab === t.key ? "bg-ge7-black text-ge7-gold-light" : "bg-white text-ge7-black/70 hover:bg-ge7-gold-soft/50"}`}><t.icon size={15} /> {t.label}</button>
        ))}
      </div>

      {tab === "taxes" && (
        <>
          <div className="mb-4 rounded-2xl border border-ge7-purple/20 bg-ge7-purple-soft px-4 py-3 text-sm text-ge7-purple">
            Les taux sont appliqués aux <strong>nouvelles</strong> factures uniquement. Chaque facture conserve son type et son taux historiques. Saisir le taux en pourcentage (ex. <code>18</code> pour 18 %).
          </div>
          <SimpleCrud<Tax>
            queryKey="taxes" url="/taxes" title="Taxes" searchable={false}
            columns={[
              { key: "type", header: "Type", render: (t) => <Badge tone={t.type === "TPS" ? "purple" : "gold"}>{t.type}</Badge> },
              { key: "rate", header: "Taux", align: "right", render: (t) => `${Number(t.rate).toFixed(2).replace(/\.?0+$/, "")} %` },
            ]}
            fields={[
              { name: "type", label: "Type", type: "select", required: true, options: [{ value: "TVA", label: "TVA" }, { value: "CSS", label: "CSS" }, { value: "TPS", label: "TPS" }] },
              { name: "rate", label: "Taux (%)", type: "number", step: "0.01", required: true },
            ]}
            empty={{ type: "TVA"}}
            allowDelete={() => true}
          />
        </>
      )}

      {tab === "zones" && (
        <SimpleCrud<Zone>
          queryKey="zones" url="/zones" title="Zones géographiques"
          columns={[
            { key: "name", header: "Zone", render: (z) => <span className="font-semibold">{z.name}</span> },
            { key: "code", header: "Code", render: (z) => z.code },
          ]}
          fields={[{ name: "name", label: "Nom", required: true }, { name: "code", label: "Code", required: true }]}
          empty={{ name: "", code: "" }}
          allowDelete={() => true}
        />
      )}

      {tab === "users" && (
        <SimpleCrud<User & { status?: string }>
          queryKey="users" url="/users" title="Utilisateurs"
          columns={[
            { key: "code", header: "Code", render: (u) => <span className="font-mono text-xs font-semibold">{u.code}</span> },
            { key: "name", header: "Nom", render: (u) => <span className="font-semibold">{u.name}</span> },
            { key: "email", header: "Email", render: (u) => u.email },
            { key: "role", header: "Rôle", render: (u) => <Badge tone={u.role === "SUPERADMIN" ? "dark" : u.role === "ADMIN" ? "dark" : u.role === "CAISSIER" ? "gold" : "purple"}>{ROLE_LABELS[u.role]}</Badge> },
          ]}
          fields={[
            { name: "name", label: "Nom", required: true, span: 2 },
            { name: "email", label: "Email", type: "email", required: true, span: 2 },
            { name: "role", label: "Rôle", type: "select", required: true, span: 2, options: (Object.keys(ROLE_LABELS) as Role[]).map((r) => ({ value: r, label: ROLE_LABELS[r] })) },
          ]}
          empty={{ name: "", email: "", role: "CAISSIER" }}
          allowDelete={(u) => u.id !== user?.id}
        />
      )}

    </>
  );
}
