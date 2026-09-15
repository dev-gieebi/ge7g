import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { homeFor } from "@/lib/rbac";
import { toApiError } from "@/lib/api";
import { Button, Logo } from "@/components/ui";

export function LoginPage() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to={homeFor(user.role)} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const u = await login(code, password);
      const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;
      navigate(from ?? homeFor(u.role), { replace: true });
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-ge7-black text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute -left-32 -top-32 size-[520px] rounded-full bg-ge7-gold/15 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 size-[460px] rounded-full bg-ge7-purple/25 blur-3xl" />
        <Logo light size={56} className="relative" />
        <div className="relative max-w-lg">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-ge7-gold">Plateforme de gestion</p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight xl:text-5xl">
            Du stock central <span className="ge7-gold-text">, en toute maîtrise.</span>
          </h1>
          <p className="mt-5 text-white/70">
            Commandes, préparation, logistique, livraisons signées, caisse et facturation,
            une seule plateforme pour G7 Energy.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 text-sm">
            {["Traçabilité totale", "Suivi de stock", "Caisse"].map((t) => (
              <div key={t} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-semibold">
                {t}
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} G-Energy 7 Group. Tous droits réservés.</p>
      </section>

      <section className="flex items-center justify-center bg-ge7-cream px-6 py-12">
        <div className="w-full max-w-md">
          <Logo size={52} className="mb-8 lg:hidden" />
          <h2 className="text-3xl font-extrabold">Connexion</h2>
          <p className="mt-1 text-sm text-ge7-black/60">Accédez à votre espace selon votre rôle.</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <label className="ge7-label">Code secret</label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ge7-black/40" />
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  autoComplete="username"
                  maxLength={8}
                  pattern="[0-9]{8}"
                  title="Code secret à 8 chiffres"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  className="ge7-input pl-10 tracking-[0.3em]"
                  placeholder="••••••••"
                />
              </div>
              <p className="mt-1 text-xs text-ge7-black/40">Votre identifiant à 8 chiffres.</p>
            </div>
            <div>
              <label className="ge7-label">Mot de passe</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ge7-black/40" />
                <input
                  type={show ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="ge7-input pl-10 pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ge7-black/40 hover:text-ge7-black"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" loading={busy} className="w-full">
              Se connecter
            </Button>
          </form>


        </div>
      </section>
    </div>
  );
}
