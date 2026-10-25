import { QueryClient } from "@tanstack/react-query";
import {
  createRouter,
  parseSearchWith,
  stringifySearchWith,
} from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    // Match Vite `base` so /checkout/* stays under /wl_checkout/...
    basepath: import.meta.env.BASE_URL.replace(/\/$/, "") || "/",
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Raw URL params — avoid JSON.stringify wrapping values in quotes (%22).
    parseSearch: parseSearchWith((value) => value),
    stringifySearch: stringifySearchWith(String),
  });

  return router;
};
