import { useEffect, useRef } from "react";
import type { FlatMissionEnvelope } from "@/lib/state/types";

function notify(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag: "blackout-mission" });
  } catch {
    /* ignore */
  }
}

/** Browser push notifications for critical swarm alerts (permission gated). */
export function useMissionPushNotifications(alerts: FlatMissionEnvelope["alerts"]) {
  const prevSig = useRef<string>("");

  useEffect(() => {
    const crit = alerts.filter((a) => a.severity === "critical");
    const sig = crit.map((a) => `${a.type}:${a.nodeId}`).join("|");
    if (!crit.length || sig === prevSig.current) return;
    prevSig.current = sig;
    notify("BLACKOUT alert", crit.map((c) => c.message).join(" · "));
  }, [alerts]);
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}
