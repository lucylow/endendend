import { createFileRoute, redirect } from "@tanstack/react-router";
import { SAR_SCENARIOS } from "@/lib/scenarios/registry";

const defaultSarSlug = SAR_SCENARIOS[0]?.slug ?? "dynamic-relay";

export const Route = createFileRoute("/scenarios/search-rescue/")({
  beforeLoad: () => {
    throw redirect({
      to: "/scenarios/search-rescue/$scenarioSlug",
      params: { scenarioSlug: defaultSarSlug },
      replace: true,
    });
  },
});
