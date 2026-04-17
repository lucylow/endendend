export type FoxMQPutOptions = { ttl?: number; token?: string };

export type FoxMQClientOptions = {
  host?: string;
  port?: number;
  clusterName?: string;
  replicationFactor?: number;
};

/** What the browser build actually runs today (Lovable-safe: no native Node broker). */
export type FoxMQRuntimeMode = "browser-replica";

export type FoxMQRuntimeInfo = {
  mode: FoxMQRuntimeMode;
  host: string;
  port: number;
  clusterName: string;
  replicationFactor: number;
};
