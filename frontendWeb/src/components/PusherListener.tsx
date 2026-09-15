import { useEffect } from "react";
import Pusher from "pusher-js";

export function PusherListener() {
  useEffect(() => {
    Pusher.logToConsole = true;

    const key = import.meta.env.VITE_PUSHER_KEY;
    const cluster = import.meta.env.VITE_PUSHER_CLUSTER;

    if (typeof key !== "string" || typeof cluster !== "string") {
      return;
    }

    const pusher = new Pusher(key, { cluster });
    const channel = pusher.subscribe("my-channel");

    channel.bind("my-event", (data: unknown) => {
      alert(JSON.stringify(data));
    });

    return () => {
      channel.unbind("my-event");
      pusher.unsubscribe("my-channel");
      pusher.disconnect();
    };
  }, []);

  return null;
}
