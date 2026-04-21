import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { AppProviders } from "./AppProviders";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { router } from "./router";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </AppErrorBoundary>,
);
