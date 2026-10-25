import { createFileRoute, redirect } from "@tanstack/react-router";

/** Former Swift checkout — locked design now lives at /wl_checkout. */
export const Route = createFileRoute("/checkout/v3")({
  beforeLoad: () => {
    throw redirect({ to: "/", search: true });
  },
});
