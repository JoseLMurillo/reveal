import { Outlet, useParams } from "react-router-dom";

import { ParticipantProvider } from "@/context/ParticipantContext";

export function ParticipantLayout() {
  const { slug = "" } = useParams<{ slug: string }>();

  return (
    <ParticipantProvider slug={slug}>
      <Outlet />
    </ParticipantProvider>
  );
}
