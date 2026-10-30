import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, LogOut, X } from "lucide-react";
import { Logo } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { CommandeStats } from "@/types";
import { navigationFor } from "../navigation";
import { ROLE_LABELS } from "@/lib/rbac";

export function Sidebar({
  open,
  onClose,
  collapsed,
  onToggleCollapse,
}: {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [tooltip, setTooltip] = useState<{ label: string; top: number; left: number } | null>(null);
  // Mobile : groupe dont les entrées sont déployées au-dessus de la barre du bas.
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  // Badge « commandes en attente » sur l'entrée Commandes en ligne (30 s).
  const { data: commandeStats } = useQuery({
    queryKey: ["commande-stats"],
    queryFn: async () => (await api.get<{ data: CommandeStats }>("/commandes/stats")).data.data,
    refetchInterval: 30_000,
    retry: false,
    enabled: !!user && ["LG_ADMIN", "DG_ADMIN", "CDG_ADMIN", "SUPERADMIN"].includes(user.role),
  });
  const enAttente = commandeStats?.en_attente ?? 0;

  if (!user) return null;
  const groups = navigationFor(user.role);
  const isActive = (item: { to: string; paths?: string[]; end?: boolean }) =>
    item.end ? pathname === item.to : (item.paths ?? [item.to]).some((p) => pathname === p || pathname.startsWith(p + "/"));
  const openGroupData = groups.find((g) => g.title === openGroup);

  return (
    <>
      {open && <div className="no-print fixed inset-0 z-30 bg-ge7-black/60 lg:hidden" onClick={onClose} />}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 flex h-screen flex-col bg-ge7-black text-white transition-all duration-200 lg:sticky lg:top-0 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "w-60 lg:w-[76px]" : "w-68"}`}
      >
        {/* Bouton de repli (desktop) — chevron sur le bord droit, comme la maquette. */}
        <button
          onClick={onToggleCollapse}
          title={collapsed ? "Déplier le menu" : "Replier le menu"}
          className="absolute -right-3.5 top-7 z-50 hidden size-7 place-items-center rounded-full bg-ge7-gold text-ge7-black shadow-lg transition hover:scale-110 lg:grid"
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>

        <div className={`flex items-center px-5 py-5 ${collapsed ? "lg:justify-center lg:px-2" : "justify-between"}`}>
          <Logo light size={42} withText={!collapsed || open} />
          <button onClick={onClose} className="rounded-lg p-1 text-white/60 hover:bg-white/10 lg:hidden">
            <X size={20} />
          </button>
        </div>
        <div className={`mx-5 h-px bg-gradient-to-r from-transparent via-ge7-gold/60 to-transparent ${collapsed ? "lg:mx-3" : ""}`} />

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
          {groups.map((g) => (
            <div key={g.title}>
              <p className={`mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-ge7-gold/70 ${collapsed ? "lg:hidden" : ""}`}>
                {g.title}
              </p>
              {collapsed && <div className="mb-1.5 hidden h-4 lg:block" />}
              <div className="space-y-0.5">
                {g.items.map((item) => (
                  <div
                    key={item.to}
                    className="group relative"
                    onMouseEnter={(e) => {
                      if (!collapsed || window.innerWidth < 1024) return;
                      const r = e.currentTarget.getBoundingClientRect();
                      setTooltip({ label: item.label, top: r.top + r.height / 2, left: r.right + 12 });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <Link
                      to={item.to}
                      onClick={onClose}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                        collapsed ? "lg:justify-center lg:px-0 lg:py-3" : ""
                      } ${
                        isActive(item)
                          ? "bg-gradient-to-r from-ge7-gold/25 to-transparent text-ge7-gold-light shadow-[inset_3px_0_0_0_#c9a227]"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span className="relative shrink-0">
                        <item.icon size={18} className="transition group-hover:text-ge7-gold-light" />
                        {collapsed && item.to === "/admin/commandes" && enAttente > 0 && (
                          <span className="absolute -right-1.5 -top-1.5 hidden size-2.5 rounded-full bg-rose-500 lg:block" />
                        )}
                      </span>
                      <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
                      {item.to === "/admin/commandes" && enAttente > 0 && (
                        <span className={`ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white ${collapsed ? "lg:hidden" : ""}`}>
                          {enAttente}
                        </span>
                      )}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Infobulle en position fixe : échappe au défilement de la nav, pas de scroll horizontal. */}
        {collapsed && tooltip && (
          <span
            style={{ top: tooltip.top, left: tooltip.left }}
            className="pointer-events-none fixed z-50 -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-ge7-black px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg"
          >
            {tooltip.label}
          </span>
        )}

        <div className="border-t border-white/10 p-4">
          {/* Version compacte (icône) — desktop replié uniquement. */}
          <div className={collapsed ? "hidden flex-col items-center gap-2 lg:flex" : "hidden"}>
            <div
              className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-ge7-purple to-ge7-purple-light font-bold text-white"
              title={`${user.name} · ${ROLE_LABELS[user.role]}`}
            >
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <button onClick={() => void logout()} title="Déconnexion" className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white">
              <LogOut size={16} />
            </button>
          </div>
          {/* Version complète — mobile et desktop déplié. */}
          <div className={`flex items-center gap-3 rounded-2xl bg-white/5 p-3 ${collapsed ? "lg:hidden" : ""}`}>
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-ge7-purple to-ge7-purple-light font-bold text-white">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{user.name}</p>
              <p className="truncate text-xs text-ge7-gold-light/80">{ROLE_LABELS[user.role]}</p>
            </div>
            <button onClick={() => void logout()} title="Déconnexion" className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      {/* Navigation mobile : titres de groupes fixés en bas ; un clic déploie
          les entrées du groupe dans un panneau au-dessus de la barre. */}
      {openGroupData && (
        <div className="no-print fixed inset-0 z-30 lg:hidden" onClick={() => setOpenGroup(null)} />
      )}
      <nav className={`no-print fixed inset-x-0 bottom-0 z-40 bg-ge7-black pb-[env(safe-area-inset-bottom)] text-white lg:hidden ${open ? "hidden" : ""}`}>
        {openGroupData && (
          <div className="max-h-[55vh] space-y-0.5 overflow-y-auto border-t border-ge7-gold/40 px-3 py-3">
            {openGroupData.items.map((item) => (
              <div key={item.to} className="group relative">
                <Link
                  to={item.to}
                  onClick={() => {
                    setOpenGroup(null);
                    onClose();
                  }}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    isActive(item)
                      ? "bg-gradient-to-r from-ge7-gold/25 to-transparent text-ge7-gold-light shadow-[inset_3px_0_0_0_#c9a227]"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="relative shrink-0">
                    <item.icon size={18} className="transition group-hover:text-ge7-gold-light" />
                  </span>
                  <span>{item.label}</span>
                  {item.to === "/admin/commandes" && enAttente > 0 && (
                    <span className="ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                      {enAttente}
                    </span>
                  )}
                </Link>
              </div>
            ))}
          </div>
        )}
        <div className="flex overflow-x-auto border-t border-ge7-gold/40">
          {groups.map((g) => (
            <button
              key={g.title}
              onClick={() => setOpenGroup(openGroup === g.title ? null : g.title)}
              className={`flex-1 shrink-0 whitespace-nowrap px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.18em] transition ${
                openGroup === g.title
                  ? "bg-ge7-gold/15 text-ge7-gold-light"
                  : g.items.some(isActive)
                    ? "text-ge7-gold"
                    : "text-ge7-gold/70"
              }`}
            >
              {g.title}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
