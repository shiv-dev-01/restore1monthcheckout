import type { Plugin } from "vite";
import type { IncomingMessage } from "node:http";

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

/**
 * Local PaymentIntent creator for `npm run dev` / `vite preview`.
 * Production static hosts should use the WhiteLabelMD panel endpoint
 * (or another server that holds STRIPE_SECRET_KEY).
 */
export function stripePaymentIntentPlugin(secretKey: string | undefined): Plugin {
  return {
    name: "stripe-payment-intent",
    configureServer(server) {
      server.middlewares.use("/api/stripe/create-payment-intent", createHandler(secretKey));
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/stripe/create-payment-intent", createHandler(secretKey));
    },
  };
}

function createHandler(secretKey: string | undefined) {
  return async (
    req: IncomingMessage,
    res: {
      statusCode: number;
      setHeader: (k: string, v: string) => void;
      end: (body?: string) => void;
    },
    next: () => void,
  ) => {
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.end();
      return;
    }

    if (req.method !== "POST") {
      next();
      return;
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (!secretKey) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "STRIPE_SECRET_KEY is not configured in .env" }));
      return;
    }

    try {
      const body = await readJsonBody(req);
      const amount = Number(body.amount);
      const email = typeof body.email === "string" ? body.email.trim() : "";
      const currency =
        typeof body.currency === "string" && body.currency.trim()
          ? body.currency.trim().toLowerCase()
          : "usd";

      if (!Number.isInteger(amount) || amount < 50) {
        res.statusCode = 422;
        res.end(
          JSON.stringify({
            message: "The given data was invalid.",
            errors: { amount: ["The amount must be an integer (cents, min 50)."] },
          }),
        );
        return;
      }
      if (!email) {
        res.statusCode = 422;
        res.end(
          JSON.stringify({
            message: "The given data was invalid.",
            errors: { email: ["The email field is required."] },
          }),
        );
        return;
      }

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(secretKey);
      const productName =
        typeof body.productName === "string"
          ? body.productName
          : typeof body.product_name === "string"
            ? body.product_name
            : "";
      const productId =
        body.productId != null
          ? String(body.productId)
          : body.product_id != null
            ? String(body.product_id)
            : "";
      const sku = typeof body.sku === "string" ? body.sku : "";

      const intent = await stripe.paymentIntents.create({
        amount,
        currency,
        receipt_email: email,
        automatic_payment_methods: { enabled: true },
        metadata: {
          email,
          ...(productName ? { productName } : {}),
          ...(productId ? { productId } : {}),
          ...(sku ? { sku } : {}),
        },
      });

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          status: 1,
          clientSecret: intent.client_secret,
          client_secret: intent.client_secret,
          paymentIntentId: intent.id,
          id: intent.id,
        }),
      );
    } catch (err) {
      console.error("[stripe-payment-intent]", err);
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : "Payment initialization failed",
        }),
      );
    }
  };
}
