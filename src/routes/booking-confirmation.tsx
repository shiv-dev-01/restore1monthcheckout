import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/booking-confirmation")({
  head: () => ({
    meta: [{ title: "Booking confirmed" }],
  }),
  component: BookingConfirmationPage,
});

function BookingConfirmationPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="flex flex-col items-center text-center">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full border-[1.5px]"
          style={{ borderColor: "#0d9488", color: "#0d9488" }}
          aria-hidden
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1
          className="mt-5 text-2xl font-bold tracking-tight sm:text-[1.75rem]"
          style={{
            color: "#1e3a5f",
            fontFamily: "Georgia, 'Times New Roman', Times, serif",
          }}
        >
          Thank you! Your booking is confirmed
        </h1>
      </div>
    </main>
  );
}
