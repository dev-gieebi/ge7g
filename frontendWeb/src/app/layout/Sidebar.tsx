import { Link, useLocation } from "react-router-dom";
import { LogOut, X } from "lucide-react";
import { Logo } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { navigationFor } from "../navigation";
import { ROLE_LABELS } from "@/lib/rbac";

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  if (!user) return null;
  const groups = navigationFor(user.role);
  const isActive = (item: { to: string; paths?: string[]; end?: boolean }) =>
    item.end ? pathname === item.to : (item.paths ?? [item.to]).some((p) => pathname === p || pathname.startsWith(p + "/"));

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-ge7-black/60 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-60 flex-col bg-ge7-black text-white transition-transform lg:sticky lg:top-0 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Logo light size={42} />
          <button onClick={onClose} className="rounded-lg p-1 text-white/60 hover:bg-white/10 lg:hidden">
            <X size={20} />
          </button>
        </div>
        <div className="mx-5 h-px bg-gradient-to-r from-transparent via-ge7-gold/60 to-transparent" />

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
          {groups.map((g) => (
            <div key={g.title}>
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-ge7-gold/70">
                {g.title}
              </p>
              <div className="space-y-0.5">
                {g.items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                      isActive(item)
                        ? "bg-gradient-to-r from-ge7-gold/25 to-transparent text-ge7-gold-light shadow-[inset_3px_0_0_0_#c9a227]"
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <item.icon size={18} className="shrink-0 transition group-hover:text-ge7-gold-light" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
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
    </>
  );
}
