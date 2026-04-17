/**
 * Minimal Stripe billing API for local development and small deployments.
 *
 * Run: STRIPE_SECRET_KEY=sk_test_... STRIPE_PRO_PRICE_ID=price_... STRIPE_ENTERPRISE_PRICE_ID=price_... npm run billing-server
 *
 * With Vite (port 8080), requests to /api/billing/* are proxied here (see vite.config.ts).
 *
 * Webhook: STRIPE_WEBHOOK_SECRET=whsec_... — POST raw body to /api/stripe/webhook
 */

import http from "node:http";
import { URL } from "node:url";
import Stripe from "stripe";

const PORT = Number(process.env.BILLING_SERVER_PORT ?? 3001);
const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

const stripe = stripeKey ? new Stripe(stripeKey) : null;

const priceIds = {
  pro: process.env.STRIPE_PRO_PRICE_ID ?? "",
  enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID ?? "",
};

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(data),
  });
  res.end(data);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function readRaw(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function subscriptionPayload(sub) {
  return {
    id: sub.id,
    status: sub.status,
    current_period_end: sub.current_period_end,
    cancel_at_period_end: sub.cancel_at_period_end,
    metadata: sub.metadata ?? {},
    items: {
      data: sub.items.data.map((item) => ({
        price: {
          id: item.price.id,
          unit_amount: item.price.unit_amount,
          currency: item.price.currency,
        },
      })),
    },
  };
}

const server = http.createServer(async (req, res) => {
  let url;
  try {
    const host = req.headers.host ?? "127.0.0.1";
    url = new URL(req.url ?? "/", `http://${host}`);
  } catch {
    json(res, 400, { error: "Invalid request URL" });
    return;
  }

  if (!stripe) {
    if (url.pathname.startsWith("/api/billing") || url.pathname.startsWith("/api/stripe")) {
      json(res, 503, { error: "Stripe not configured (missing STRIPE_SECRET_KEY)" });
      return;
    }
    json(res, 404, { error: "Not found" });
    return;
  }

  try {
    if (req.method === "POST" && url.pathname === "/api/stripe/webhook") {
      if (!webhookSecret) {
        json(res, 503, { error: "STRIPE_WEBHOOK_SECRET not set" });
        return;
      }
      const sig = req.headers["stripe-signature"];
      if (!sig || Array.isArray(sig)) {
        json(res, 400, { error: "Missing stripe-signature" });
        return;
      }
      const raw = await readRaw(req);
      let event;
      try {
        event = stripe.webhooks.constructEvent(raw, sig, webhookSecret);
      } catch {
        json(res, 400, { error: "Webhook signature verification failed" });
        return;
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const tier = session.metadata?.tier;
        console.info("[stripe webhook] checkout.session.completed", {
          customer: session.customer,
          tier,
        });
        // Persist tier ↔ customer in your database here.
      }

      json(res, 200, { received: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/billing/subscription") {
      const customerId = url.searchParams.get("customerId");
      if (!customerId) {
        json(res, 200, { subscription: null });
        return;
      }
      const list = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 3 });
      const active = list.data.find((s) => s.status === "active" || s.status === "trialing") ?? list.data[0];
      json(res, 200, { subscription: active ? subscriptionPayload(active) : null });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/billing/checkout") {
      const body = await readJson(req);
      const tier = body.tier;
      const successUrl =
        typeof body.successUrl === "string"
          ? body.successUrl
          : `${body.origin ?? "http://localhost:8080"}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl =
        typeof body.cancelUrl === "string" ? body.cancelUrl : `${body.origin ?? "http://localhost:8080"}/dashboard/billing`;

      if (tier !== "pro" && tier !== "enterprise") {
        json(res, 400, { error: "Invalid tier" });
        return;
      }
      const price = priceIds[tier];
      if (!price) {
        json(res, 503, { error: `Missing price ID for ${tier}` });
        return;
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        payment_method_options: {
          card: {
            request_three_d_secure: "automatic",
          },
        },
        line_items: [{ price, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { tier },
        subscription_data: { metadata: { tier } },
        allow_promotion_codes: true,
      });

      json(res, 200, { url: session.url });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/billing/portal") {
      const body = await readJson(req);
      const customerId = body.customerId;
      const returnUrl =
        typeof body.returnUrl === "string" ? body.returnUrl : "http://localhost:8080/dashboard/billing";
      if (!customerId || typeof customerId !== "string") {
        json(res, 400, { error: "customerId required" });
        return;
      }
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });
      json(res, 200, { url: session.url });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/billing/sync-session") {
      const body = await readJson(req);
      const sessionId = body.sessionId;
      if (!sessionId || typeof sessionId !== "string") {
        json(res, 400, { error: "sessionId required" });
        return;
      }
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription", "customer"],
      });
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
      if (!customerId) {
        json(res, 400, { error: "No customer on session" });
        return;
      }
      let subscription = null;
      if (typeof session.subscription === "string") {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        subscription = subscriptionPayload(sub);
      } else if (session.subscription && typeof session.subscription === "object") {
        subscription = subscriptionPayload(session.subscription);
      }
      json(res, 200, { customerId, subscription });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/billing/setup-intent") {
      const body = await readJson(req);
      const customerId = body.customerId;
      if (!customerId || typeof customerId !== "string") {
        json(res, 400, { error: "customerId required" });
        return;
      }
      const intent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ["card"],
        usage: "off_session",
      });
      json(res, 200, { clientSecret: intent.client_secret });
      return;
    }

    json(res, 404, { error: "Not found" });
  } catch (err) {
    console.error("[billing-server]", err);
    const message = err instanceof Error ? err.message : "Server error";
    json(res, 500, { error: message });
  }
});

server.on("error", (err) => {
  console.error("[billing-server] listen error", err);
  process.exitCode = 1;
});

server.listen(PORT, () => {
  console.info(`Stripe billing server listening on http://127.0.0.1:${PORT}`);
});
