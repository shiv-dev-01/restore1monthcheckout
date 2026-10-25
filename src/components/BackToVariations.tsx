import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function BackToVariations() {
  return (
    <Link
      to="/checkout"
      className="fixed bottom-4 left-4 z-50 inline-flex items-center gap-2 rounded-full border border-white/20 bg-[#0A1620]/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white shadow-lg backdrop-blur transition-transform hover:-translate-y-0.5"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      All variations
    </Link>
  );
}
