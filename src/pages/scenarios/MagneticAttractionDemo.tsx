import ScenarioDemoShell from "@/components/scenarios/ScenarioDemoShell";
import MagneticAttractionScenario from "@/scenarios/magnetic-attraction/MagneticAttractionScenario";

export default function MagneticAttractionDemo() {
  return (
    <ScenarioDemoShell slug="magnetic-attraction" bgClass="bg-zinc-950">
      <MagneticAttractionScenario />
    </ScenarioDemoShell>
  );
}
