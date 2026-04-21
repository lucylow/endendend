import { createFileRoute } from "@tanstack/react-router";
import AuctionsPage from "@/pages/dashboard/Auctions";

export const Route = createFileRoute("/tasks")({
  component: AuctionsPage,
});
