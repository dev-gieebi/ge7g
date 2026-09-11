import { useState } from "react";
import { Bell, Menu } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, getList } from "@/lib/api";
import type { Notification } from "@/types";
import { relative } from "@/lib/format";
import { Logo } from "@/components/ui";

export function Header({ onMenu }: { onMenu: () => void }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getList<Notification>("/notifications", { per_page: 10 }),
    refetchInterval: 60_000,
    retry: false,
  });
  const markAll = useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const unread = data?.data.filter((n) => !n.read_at).length ?? 0;

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-ge7-black/5 bg-ge7-cream/85 px-4 py-3 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        <button onClick={onMenu} className="rounded-xl border border-ge7-black/10 bg-white p-2 lg:hidden">
          <Menu size={20} />
        </button>
        <Logo size={32} withText={false} className="lg:hidden" />
      </div>
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="relative rounded-xl border border-ge7-black/10 bg-white p-2 transition hover:border-ge7-gold"
        >
          <Bell size={19} />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-ge7-purple text-[10px] font-bold text-white">
              {unread}
            </span>
          )}
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-ge7-black/5 bg-white shadow-soft">
            <div className="flex items-center justify-between bg-ge7-black px-4 py-3 text-sm text-white">
              <span className="font-bold">Notifications</span>
              {unread > 0 && (
                <button onClick={() => markAll.mutate()} className="text-xs text-ge7-gold-light hover:underline">
                  Tout marquer lu
                </button>
              )}
            </div>
            <div className="max-h-80 divide-y divide-ge7-black/5 overflow-y-auto">
              {!data?.data.length ? (
                <p className="px-4 py-8 text-center text-sm text-ge7-black/50">Aucune notification</p>
              ) : (
                data.data.map((n) => (
                  <Link
                    key={n.id}
                    to={n.link ?? "#"}
                    onClick={() => setOpen(false)}
                    className={`block px-4 py-3 text-sm hover:bg-ge7-gold-soft/40 ${n.read_at ? "opacity-60" : ""}`}
                  >
                    <p className="font-semibold">{n.title}</p>
                    <p className="text-xs text-ge7-black/60">{n.message}</p>
                    <p className="mt-1 text-[11px] text-ge7-bronze">{relative(n.created_at)}</p>
                  </Link>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
