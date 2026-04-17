/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STAKING_CONTRACT_ADDRESS?: string;
  readonly VITE_TASHI_TOKEN_ADDRESS?: string;
  readonly VITE_DISPLAY_APY?: string;
  /** FoxMQ broker hostname (UI metadata + future native client; browser build uses local replica). */
  readonly VITE_FOXMQ_HOST?: string;
  readonly VITE_FOXMQ_PORT?: string;
  readonly VITE_FOXMQ_CLUSTER_NAME?: string;
  readonly VITE_FOXMQ_REPLICATION_FACTOR?: string;
  /** When set, Put/CAS require matching token (demo hardening). */
  readonly VITE_FOXMQ_AUTH_TOKEN?: string;
  /** Webots / FoxMQ telemetry WebSocket URL (default ws://127.0.0.1:8080/telemetry) */
  readonly VITE_SWARM_WS_URL?: string;
  /** Comma-separated WebSocket URLs — dashboard merges streams (multi-gateway / no single point of failure). */
  readonly VITE_SWARM_WS_URLS?: string;
  /** Stripe.js publishable key (Checkout redirect + Elements) */
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  /** Optional override when billing API is not same-origin (default: relative /api/...) */
  readonly VITE_BILLING_API_URL?: string;
  /** Optional: mirror server price IDs for tier detection in the UI */
  readonly VITE_STRIPE_PRO_PRICE_ID?: string;
  readonly VITE_STRIPE_ENTERPRISE_PRICE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
