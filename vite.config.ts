import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { handleAiHelperRequest } from "./server/ai-helper.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  return {
    base: "./",
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "ecomvault-ai-helper",
        configureServer(server) {
          server.middlewares.use("/api/ai-helper", (request, response) => {
            void handleAiHelperRequest(request, response, {
              apiKey: env.GROQ_API_KEY,
              model: env.GROQ_MODEL,
            });
          });
        },
      },
    ],
  };
});
