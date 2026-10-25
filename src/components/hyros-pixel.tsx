import { attributedUrl } from "@/lib/tracking-params";
import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

/**
 * Hyros universal script — fires on each checkout route so SPA navigations
 * keep attribution (ref_url is document.URL with stored UTM / fbc_id / h_ad_id).
 * Matches the pixel supplied by the Restore funnel team.
 */
const HYROS_SCRIPT_BASE =
  "https://t.restoredelivered.com/v1/b98cf5262925306136c9970570205fd4d7410f27e6a16998b96b737be6277c55?tag=!clicked&ref_url=";

export function HyrosPixel() {
  const href = useRouterState({ select: (s) => s.location.href });

  useEffect(() => {
    const head = document.head;
    // Drop prior injects so SPA route changes don't stack duplicate tags.
    head.querySelectorAll('script[data-hyros="wl-checkout"]').forEach((el) => el.remove());

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = HYROS_SCRIPT_BASE + encodeURI(attributedUrl(document.URL));
    script.dataset.hyros = "wl-checkout";
    head.appendChild(script);
  }, [href]);

  return null;
}
