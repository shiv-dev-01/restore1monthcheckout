/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  readonly VITE_STRIPE_PAYMENT_INTENT_API?: string;
  /** Set to "1" to call the panel intent API during `npm run dev` instead of the local middleware. */
  readonly VITE_STRIPE_USE_PANEL_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
