import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

/**
 * Version de la compilation : intégrée au code (__APP_VERSION__) et publiée
 * dans /version.json. L'application compare les deux pour se mettre à jour
 * toute seule après une mise en ligne (voir src/lib/miseAJour.tsx).
 */
const APP_VERSION = new Date().toISOString();

function versionJson(): Plugin {
  return {
    name: "ge7-version-json",
    apply: "build",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ version: APP_VERSION }) });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss(), versionJson()],
    define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
    resolve: {
      alias: { "@": path.resolve(__dirname, "src") },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
         //target: "https://api-ge7g.com",
          // Backend GE7Stock local (php artisan serve --port=8001) : le port 8000
          // est occupé par un autre projet (AppPointage).
          target: "http://127.0.0.1:8001",
          changeOrigin: true,
        },
        "/storage": {
          target: "https://api-ge7g.com",
          //target: "http://127.0.0.1:8000",
          changeOrigin: true,
        },
      },
    },
  };
});
