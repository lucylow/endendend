import ScenarioDemoShell from "@/components/scenarios/ScenarioDemoShell";
import CollapsingTunnelScenario from "@/scenarios/collapsing-tunnel/CollapsingTunnelScenario";

export default function CollapsingTunnelDemo() {
  return (
    <ScenarioDemoShell slug="collapsing-tunnel" bgClass="bg-zinc-950">
      <CollapsingTunnelScenario />
    </ScenarioDemoShell>
  );
}
