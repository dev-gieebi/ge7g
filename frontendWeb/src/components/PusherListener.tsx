import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Pusher from "pusher-js";

/**
 * Temps réel : quand un autre utilisateur enregistre, modifie ou supprime
 * une donnée (produit, catégorie, unité, commande, vente…), le serveur
 * diffuse « donnees.modifiees » sur le canal « ge7 » ; les listes affichées
 * sont alors rechargées aussitôt. Sans clés Pusher configurées, rien ne
 * s'active (les écrans se mettent quand même à jour après chaque
 * enregistrement et au retour sur l'onglet).
 */
export function PusherListener() {
  const qc = useQueryClient();

  useEffect(() => {
    const key = import.meta.env.VITE_PUSHER_KEY;
    const cluster = import.meta.env.VITE_PUSHER_CLUSTER;

    if (typeof key !== "string" || key === "" || typeof cluster !== "string" || cluster === "") {
      return;
    }

    const pusher = new Pusher(key, { cluster });
    const channel = pusher.subscribe("ge7");

    // Plusieurs signaux rapprochés (vente avec plusieurs lignes…) : un seul rechargement.
    let minuterie: number | undefined;
    channel.bind("donnees.modifiees", () => {
      window.clearTimeout(minuterie);
      minuterie = window.setTimeout(() => void qc.invalidateQueries(), 300);
    });

    return () => {
      window.clearTimeout(minuterie);
      channel.unbind("donnees.modifiees");
      pusher.unsubscribe("ge7");
      pusher.disconnect();
    };
  }, [qc]);

  return null;
}
