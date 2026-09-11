import { Link } from "react-router-dom";
import { ShieldX } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { homeFor, isWebRole } from "@/lib/rbac";
import { Button, Logo } from "@/components/ui";

export function ForbiddenPage() {
  const { user, logout } = useAuth();
  const internal = user && isWebRole(user.role);

  return (
    <div className="grid min-h-screen place-items-center bg-ge7-cream px-4">
      <div className="w-full max-w-md rounded-3xl border border-ge7-gold/20 bg-white p-10 text-center shadow-xl">
        <Logo size={52} className="justify-center" />
        <div className="mx-auto mt-6 grid size-16 place-items-center rounded-2xl bg-ge7-purple-soft text-ge7-purple">
          <ShieldX size={30} />
        </div>
        <p className="mt-4 font-display text-5xl font-extrabold text-ge7-gold">403</p>
        <h1 className="mt-2 text-lg font-bold">Accès refusé</h1>
        <p className="mt-2 text-sm text-ge7-black/60">
          {internal
            ? "Votre rôle ne vous permet pas d'accéder à cette page."
            : "L'application Web est réservée aux équipes internes G7 Energy. Les clients et chauffeurs utilisent l'application mobile."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          {internal ? (
            <Link to={homeFor(user.role)}>
              <Button>Retour à l'accueil</Button>
            </Link>
          ) : (
            <Button onClick={() => void logout()}>Se déconnecter</Button>
          )}
        </div>
      </div>
    </div>
  );
}
