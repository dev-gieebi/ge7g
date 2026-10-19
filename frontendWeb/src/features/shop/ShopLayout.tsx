import { useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { KeyRound, Menu, PackageSearch, Search, ShoppingCart, Store, X } from "lucide-react";
import { Logo } from "@/components/ui";
import { GE7_COMPANY } from "@/features/shared/companyInfo";
import { useCart } from "./cart";

/**
 * Layout de la boutique publique — visible par tous, sans compte.
 * L'espace personnel reste derrière le bouton « Connexion ».
 */
export function ShopLayout() {
  const navigate = useNavigate();
  const cart = useCart();
  const [search, setSearch] = useState("");
  const [menu, setMenu] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/produits${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ""}`);
    setMenu(false);
  };

  const links = [
    { to: "/", label: "Accueil", end: true },
    { to: "/produits", label: "Catalogue", end: false },
    { to: "/suivi", label: "Suivi de commande", end: false },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-ge7-cream">
      <header className="sticky top-0 z-40 bg-[#151515] text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/" className="shrink-0">
            <Logo light size={40} />
          </Link>

          <form onSubmit={submit} className="relative mx-auto hidden w-full max-w-md md:block">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un produit…"
              className="w-full rounded-full border border-white/10 bg-white/10 py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus:border-ge7-gold focus:outline-none"
            />
          </form>

          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `rounded-full px-3.5 py-2 text-sm font-semibold transition ${isActive ? "bg-ge7-gold/20 text-ge7-gold-light" : "text-white/70 hover:text-white"}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <Link to="/panier" className="relative ml-auto rounded-full p-2.5 text-white/80 transition hover:bg-white/10 hover:text-white md:ml-0">
            <ShoppingCart size={21} />
            {cart.count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-ge7-gold px-1 text-[11px] font-bold text-ge7-black">
                {cart.count}
              </span>
            )}
          </Link>

          <Link
            to="/login"
            className="hidden items-center gap-2 rounded-full bg-ge7-gold px-4 py-2 text-sm font-bold text-ge7-black transition hover:brightness-110 md:inline-flex"
          >
            <KeyRound size={15} /> Connexion
          </Link>

          <button onClick={() => setMenu((m) => !m)} className="rounded-full p-2.5 text-white/80 hover:bg-white/10 md:hidden">
            {menu ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>

        {menu && (
          <div className="border-t border-white/10 px-4 pb-4 pt-3 md:hidden">
            <form onSubmit={submit} className="relative mb-3">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un produit…"
                className="w-full rounded-full border border-white/10 bg-white/10 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus:border-ge7-gold focus:outline-none"
              />
            </form>

            <nav className="flex flex-col gap-1">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  onClick={() => setMenu(false)}
                  className={({ isActive }) =>
                    `rounded-xl px-3.5 py-2.5 text-sm font-semibold ${isActive ? "bg-ge7-gold/20 text-ge7-gold-light" : "text-white/75"}`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
              <Link to="/login" onClick={() => setMenu(false)} className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-ge7-gold px-4 py-2.5 text-sm font-bold text-ge7-black">
                <KeyRound size={15} /> Connexion
              </Link>
            </nav>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="bg-[#151515] text-white/60">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm sm:grid-cols-3">
          <div>
            <div className="mb-3 flex items-center gap-2 text-white"><Store size={18} className="text-ge7-gold" /><span className="font-bold">G-ENERGIE 7 GROUPE</span></div>
            <p>{GE7_COMPANY.activities[0]}</p>
          </div>
          <div>
            <p className="mb-2 font-bold text-white">Contact</p>
            <p>{GE7_COMPANY.address}</p>
            <p>{GE7_COMPANY.phones}</p>
            <p>{GE7_COMPANY.email}</p>
          </div>
          <div>
            <p className="mb-2 font-bold text-white">Boutique</p>
            <Link to="/produits" className="block hover:text-white">Catalogue</Link>
            <Link to="/suivi" className="mt-1 flex items-center gap-1.5 hover:text-white"><PackageSearch size={14} /> Suivre ma commande</Link>
            <p className="mt-3 text-xs">{GE7_COMPANY.website}</p>
          </div>
        </div>
        <p className="border-t border-white/10 py-4 text-center text-xs">© {new Date().getFullYear()} G-ENERGIE 7 GROUPE Paiement à la livraison</p>
      </footer>
    </div>
  );
}
