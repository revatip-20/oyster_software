import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const backendApiUrl =
    env.BACKEND_API_URL ||
    env.VITE_BACKEND_API_URL ||
    process.env.BACKEND_API_URL ||
    process.env.VITE_BACKEND_API_URL ||
    "https://oyster-software.onrender.com";

  return {
    plugins: [react()],
    base: "./",
    envDir: __dirname,
    envPrefix: ["VITE_", "BACKEND_"],
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
    },
    define: {
      "process.env.BACKEND_API_URL": JSON.stringify(backendApiUrl),
      "process.env.VITE_BACKEND_API_URL": JSON.stringify(backendApiUrl),
    },
  };
});

