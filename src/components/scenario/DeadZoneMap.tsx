import { memo, useEffect, useRef } from "react";

type Cell = { gx: number; gz: number; kind: "unknown" | "dead" };

/**
 * Lightweight canvas sketch of unknown / comm-dead cells for tunnel ops.
 */
export const DeadZoneMap = memo(function DeadZoneMap({ cells }: { cells: Cell[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const cssW = Math.max(120, c.clientWidth);
    const cssH = Math.max(96, c.clientHeight);
    c.width = cssW;
    c.height = cssH;
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, cssW, cssH);
    if (!cells.length) {
      ctx.fillStyle = "#52525b";
      ctx.font = "11px ui-monospace, monospace";
      ctx.fillText("No dead-zone projection", 8, 16);
      return;
    }
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (const p of cells) {
      minX = Math.min(minX, p.gx);
      maxX = Math.max(maxX, p.gx);
      minZ = Math.min(minZ, p.gz);
      maxZ = Math.max(maxZ, p.gz);
    }
    const pad = 1;
    minX -= pad;
    maxX += pad;
    minZ -= pad;
    maxZ += pad;
    const sx = cssW / Math.max(1, maxX - minX);
    const sz = cssH / Math.max(1, maxZ - minZ);
    const sc = Math.min(sx, sz) * 0.85;
    const ox = (cssW - (maxX - minX) * sc) / 2 - minX * sc;
    const oz = (cssH - (maxZ - minZ) * sc) / 2 - minZ * sc;
    for (const p of cells) {
      const x = p.gx * sc + ox;
      const y = p.gz * sc + oz;
      ctx.fillStyle = p.kind === "dead" ? "rgba(239,68,68,0.55)" : "rgba(113,113,122,0.45)";
      ctx.fillRect(x, y, Math.max(2, sc * 0.9), Math.max(2, sc * 0.9));
    }
    ctx.strokeStyle = "#22d3ee55";
    ctx.strokeRect(0.5, 0.5, cssW - 1, cssH - 1);
  }, [cells]);

  return (
    <canvas
      ref={ref}
      className="h-28 w-full rounded-md border border-zinc-800 bg-black"
      aria-label="Dead zone map: unknown cells and high packet-loss areas"
    />
  );
});
