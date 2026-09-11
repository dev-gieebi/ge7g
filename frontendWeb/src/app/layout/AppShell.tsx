import { useState } from "react";
import { Outlet } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/ui";

export function AppShell() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();

  // La caissière n'a accès qu'à l'écran de vente : pas de sidebar ni de navigation.
  if (user?.role === "CAISSIER") {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ge7-black/5 bg-ge7-cream/85 px-4 py-2.5 backdrop-blur sm:px-6">
          <Logo size={30} />
          <button
            onClick={() => void logout()}
            title="Déconnexion"
            className="inline-flex items-center gap-2 rounded-xl border border-ge7-black/10 bg-white px-3 py-2 text-sm font-semibold text-ge7-black/70 transition hover:border-ge7-gold hover:text-ge7-black"
          >
            <LogOut size={16} /> Déconnexion
          </button>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenu={() => setOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
