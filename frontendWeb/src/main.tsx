import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/lib/toast";
import { router } from "@/app/router";
import { PusherListener } from "@/components/PusherListener";
import "./styles.css";

const queryClient: QueryClient = new QueryClient({
  // Après chaque enregistrement (création, modification, suppression), toutes
  // les données affichées sont rechargées : listes, sélecteurs (unités,
  // catégories, produits…), compteurs. Plus besoin de recharger la page.
  mutationCache: new MutationCache({
    onSuccess: () => void queryClient.invalidateQueries(),
  }),
  defaultOptions: {
    // Retour sur l'onglet : les données sont rafraîchies.
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <PusherListener />
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
