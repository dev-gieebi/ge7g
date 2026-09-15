import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ModuleTabs } from "@/components/ui";
import { SYSTEME_TABS } from "@/app/moduleTabs";
import { Key, MapPin, Percent, Users } from "lucide-react";
import type { Role, Tax, User, Zone } from "@/types";
import { ROLE_LABELS } from "@/lib/rbac";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { api, toApiError } from "@/lib/api";
import { Badge, Button, Input, Modal, PageHeader } from "@/components/ui";
import { SimpleCrud } from "./SimpleCrud";

type Tab = "taxes" | "zones" | "users";
const TABS: { key: Tab; label: string; icon: typeof Percent }[] = [
  { key: "taxes", label: "Fiscalité", icon: Percent },
  { key: "zones", label: "Zones", icon: MapPin },
  { key: "users", label: "Utilisateurs", icon: Users },
];

export function SettingsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPERADMIN";
  const availableTabs = TABS.filter((t) => t.key !== "users" || isSuperAdmin);
  const [tab, setTab] = useState<Tab>(availableTabs[0]?.key ?? "taxes");

  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [password, setPassword] = useState("");
  const generatePassword = (length = 16) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*_+-";
    const array = new Uint32Array(length);
    window.crypto.getRandomValues(array);
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars[array[i] % chars.length];
    }
    return result;
  };
  const notify = useToast();
  const qc = useQueryClient();
  const passwordMutation = useMutation<void, unknown, { id: number; password: string }>({
    mutationFn: ({ id, password }) => api.put(`/users/${id}/password`, { password }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      notify("Mot de passe mis à jour");
      setPasswordUser(null);
      setPassword("");
    },
    onError: (e) => notify(toApiError(e).message, "error"),
  });

  return (
    <>
      <ModuleTabs tabs={SYSTEME_TABS} />
      <PageHeader title="Paramètres" subtitle="Configuration fiscale, zones géographiques et comptes utilisateurs." breadcrumb="Système" />
      <div className="mb-6 flex flex-wrap gap-2">
        {availableTabs.map((t) => (
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
        <>
          <SimpleCrud<User & { status?: string }>
            queryKey="users" url="/users" title="Utilisateurs"
            columns={[
              { key: "code", header: "Code", render: (u) => <span className="font-mono text-xs font-semibold">{u.code}</span> },
              { key: "name", header: "Nom", render: (u) => <span className="font-semibold">{u.name}</span> },
              { key: "role", header: "Rôle", render: (u) => <Badge tone={u.role === "SUPERADMIN" ? "dark" : u.role === "AG_LOGISTIQUE" ? "dark" : u.role === "CAISSIER" ? "gold" : "purple"}>{ROLE_LABELS[u.role]}</Badge> },
            ]}
            fields={[
              { name: "name", label: "Nom", required: true, span: 2 },
              { name: "role", label: "Rôle", type: "select", required: true, span: 2, options: (Object.keys(ROLE_LABELS) as Role[]).map((r) => ({ value: r, label: ROLE_LABELS[r] })) },
            ]}
            empty={{ name: "", role: "CAISSIER" }}
            allowDelete={(u) => u.id !== user?.id}
            extraActions={(u) => (
              <Button size="sm" variant="ghost" onClick={() => { setPasswordUser(u); setPassword(generatePassword()); }}>
                <Key size={14} />
              </Button>
            )}
          />
          {passwordUser && (
            <Modal
              title={`Modifier le mot de passe — ${passwordUser.name}`}
              size="sm"
              onClose={() => { setPasswordUser(null); setPassword(""); }}
              footer={
                <>
                  <Button variant="secondary" onClick={() => setPasswordUser(null)}>Annuler</Button>
                  <Button loading={passwordMutation.isPending} onClick={() => passwordMutation.mutate({ id: passwordUser.id, password })}>Enregistrer</Button>
                </>
              }
            >
              <Input type="text" label="Mot de passe généré" value={password} readOnly />
            </Modal>
          )}
        </>
      )}

    </>
  );
}
