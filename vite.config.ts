import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { stripePaymentIntentPlugin } from "./vite-plugin-stripe-intent";

// Plain client-side React SPA.
// `npm run build` outputs a static production bundle into ./build
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    // Deploy under https://checkout.restoredelivered.com/monthly_checkout/
    base: "/monthly_checkout/",
    plugins: [
      tsconfigPaths(),
      tanstackRouter({
        target: "react",
        routesDirectory: "src/routes",
        generatedRouteTree: "src/routeTree.gen.ts",
        autoCodeSplitting: true,
      }),
      react(),
      tailwindcss(),
      stripePaymentIntentPlugin(env.STRIPE_SECRET_KEY),
    ],
    build: {
      outDir: "build",
    },
  };
});
