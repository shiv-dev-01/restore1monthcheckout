import { createFileRoute, redirect } from "@tanstack/react-router";

/** Variation 2 hidden — use /wl_checkout. */
export const Route = createFileRoute("/checkout/v2")({
  beforeLoad: () => {
    throw redirect({ to: "/", search: true });
  },
});
