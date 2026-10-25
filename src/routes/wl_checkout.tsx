import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy path — checkout now lives at `/` under the `/wl_checkout` router basepath. */
export const Route = createFileRoute("/wl_checkout")({
  beforeLoad: () => {
    throw redirect({ to: "/", search: true });
  },
});
