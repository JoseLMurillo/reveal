import { QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { RouterProvider } from "react-router-dom";

import { AdminAuthProvider } from "@/context/AdminAuthContext";
import { queryClient } from "@/services/query-client";
import { router } from "@/routes/router";

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider>
        <MotionConfig reducedMotion="user">
          <RouterProvider router={router} />
        </MotionConfig>
      </AdminAuthProvider>
    </QueryClientProvider>
  );
}
