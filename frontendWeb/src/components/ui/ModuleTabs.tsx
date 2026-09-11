import { NavLink } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import type { Role } from "@/types";

export interface ModuleTab {
  label: string;
  to: string;
  roles?: Role[];
  end?: boolean;
}

/** Barre d'onglets reliant les pages d'un même module (sidebar allégée). */
export function ModuleTabs({ tabs }: { tabs: ModuleTab[] }) {
  const { user } = useAuth();
  const visible = tabs.filter((t) => !t.roles || (user && hasRole(user, ...t.roles)));
  if (visible.length < 2) return null;
  return (
    <div className="mb-5 flex flex-wrap gap-1 border-b border-ge7-black/10">
      {visible.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end ?? true}
          className={({ isActive }) =>
            `rounded-t-xl px-4 py-2.5 text-sm font-semibold transition ${
              isActive
                ? "border-b-2 border-ge7-gold bg-white text-ge7-purple shadow-sm"
                : "text-ge7-black/55 hover:bg-white/60 hover:text-ge7-black"
            }`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </div>
  );
}
