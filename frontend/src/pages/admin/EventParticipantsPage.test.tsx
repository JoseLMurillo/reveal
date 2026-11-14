import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { ApiError } from "@/services/api";
import { adminApi } from "@/services/admin";
import {
  ACCESS_CODE,
  adminCreateResultFixture,
  adminEventDetailFixture,
  adminParticipantFixture,
  EVENT_ID,
  PARTICIPANT_ID,
} from "@/test/fixtures";

import { EventParticipantsPage } from "./EventParticipantsPage";

vi.mock("@/services/admin", () => ({
  adminApi: {
    detail: vi.fn(),
    listParticipants: vi.fn(),
    createParticipant: vi.fn(),
    bulkCreateParticipants: vi.fn(),
    updateParticipant: vi.fn(),
    regenerateAccessCode: vi.fn(),
    revokeAccessCode: vi.fn(),
  },
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/admin/events/${EVENT_ID}/participants`]}>
        <Routes>
          <Route path="/admin/events/:id/participants" element={<EventParticipantsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockList() {
  vi.mocked(adminApi.detail).mockResolvedValue(adminEventDetailFixture);
  vi.mocked(adminApi.listParticipants).mockResolvedValue({
    data: [adminParticipantFixture],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  });
}

describe("EventParticipantsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList();
  });

  it("lista los participantes con su estado y cuota", async () => {
    renderPage();

    expect(await screen.findByText("Ana")).toBeInTheDocument();
    expect(screen.getByText(/mesa 4/i)).toBeInTheDocument();
    expect(screen.getByText("abc123…")).toBeInTheDocument();
    expect(screen.getAllByText("Activo").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1 participantes/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/9 lugares restantes/i)).toBeInTheDocument();

    expect(adminApi.listParticipants).toHaveBeenCalledWith(EVENT_ID, {
      page: 1,
      limit: 20,
      search: undefined,
      anonymous: undefined,
      isActive: undefined,
      source: undefined,
    });
  });

  it("crea un participante y muestra el enlace una sola vez", async () => {
    vi.mocked(adminApi.createParticipant).mockResolvedValue(adminCreateResultFixture);

    renderPage();

    await screen.findByText("Ana");
    fireEvent.click(screen.getByRole("button", { name: /nuevo participante/i }));

    fireEvent.change(screen.getByLabelText(/^nombre/i), {
      target: { value: "Marta" },
    });
    fireEvent.click(screen.getByRole("button", { name: /crear enlace/i }));

    expect(await screen.findByRole("heading", { name: /cópialos ahora/i })).toBeInTheDocument();
    expect(adminApi.createParticipant).toHaveBeenCalledWith(EVENT_ID, {
      displayName: "Marta",
      note: undefined,
    });
    expect(screen.getByText(adminCreateResultFixture.access.url)).toBeInTheDocument();
  });

  it("regenera el enlace tras confirmar la revocación", async () => {
    vi.mocked(adminApi.regenerateAccessCode).mockResolvedValue({
      participantId: PARTICIPANT_ID,
      access: {
        code: ACCESS_CODE,
        url: `https://rollo.test/e/cumple-ana/a/${ACCESS_CODE}`,
        createdAt: "2026-11-13T16:00:00.000Z",
      },
      sessionsRevoked: true,
    });

    renderPage();

    await screen.findByText("Ana");
    fireEvent.click(screen.getByRole("button", { name: /regenerar/i }));

    expect(
      screen.getByRole("heading", { name: /regenerar el código de acceso/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /regenerar enlace/i }));

    await waitFor(() => {
      expect(adminApi.regenerateAccessCode).toHaveBeenCalledWith(PARTICIPANT_ID, {
        revokeSessions: true,
      });
    });
  });

  it("muestra el error cuando la lista no se puede cargar", async () => {
    vi.mocked(adminApi.listParticipants).mockRejectedValue(
      new ApiError("Sin acceso.", { status: 403, code: "FORBIDDEN" }),
    );

    renderPage();

    expect(await screen.findByText(/no se pudieron cargar los participantes/i)).toBeInTheDocument();
  });
});
