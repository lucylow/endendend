import { createFileRoute } from "@tanstack/react-router";
import BatteryCascadeDemo from "@/pages/scenarios/BatteryCascadeDemo";

export const Route = createFileRoute("/scenarios/battery-cascade")({
  component: BatteryCascadeDemo,
});
