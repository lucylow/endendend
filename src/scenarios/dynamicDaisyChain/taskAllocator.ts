import type { DaisyEvent, SimNode, SwarmTask } from "./types";
import { emitEvent } from "./eventStream";

let taskSeq = 0;

export function allocateTunnelTasks(
  nodes: SimNode[],
  lead: SimNode,
  t: number,
  existing: SwarmTask[],
  events: DaisyEvent[],
): SwarmTask[] {
  const tasks = [...existing.filter((x) => x.status !== "completed")];
  const has = (title: string) => tasks.some((x) => x.title === title && x.status !== "failed");

  if (!has("Frontier exploration") && lead.s > 8) {
    taskSeq += 1;
    tasks.push({
      id: `task_fe_${taskSeq}`,
      title: "Frontier exploration",
      status: "assigned",
      priority: 10,
      assigneeId: lead.id,
      fallbackIds: nodes.filter((n) => n.profile.explorerSuitability > 0.5).map((n) => n.id),
      createdAt: t,
    });
    events.push(emitEvent(t, "task_reassigned", "Frontier exploration bound to lead", [lead.id]));
  }

  const relays = nodes.filter((n) => n.isRelay);
  for (const r of relays) {
    const title = `Relay placement ${r.id}`;
    if (!has(title)) {
      taskSeq += 1;
      tasks.push({
        id: `task_rp_${taskSeq}_${r.id}`,
        title,
        status: "assigned",
        priority: 8,
        assigneeId: r.id,
        fallbackIds: nodes.filter((n) => n.profile.relaySuitability > 0.7 && n.id !== r.id).map((n) => n.id),
        createdAt: t,
      });
    }
  }

  if (!has("Return path stabilization") && lead.s > lead.profile.rangeProfileM * 0.45) {
    taskSeq += 1;
    tasks.push({
      id: `task_rt_${taskSeq}`,
      title: "Return path stabilization",
      status: "open",
      priority: 6,
      assigneeId: null,
      fallbackIds: nodes.map((n) => n.id),
      createdAt: t,
    });
  }

  return tasks;
}
