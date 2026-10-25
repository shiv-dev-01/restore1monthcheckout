import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

/** Variation 1 hidden — use /wl_checkout. */
export const Route = createFileRoute("/checkout/v1")({
  beforeLoad: () => {
    throw redirect({ to: "/", search: true });
  },
  component: CheckoutV1Layout,
});

function CheckoutV1Layout() {
  return <Outlet />;
}
