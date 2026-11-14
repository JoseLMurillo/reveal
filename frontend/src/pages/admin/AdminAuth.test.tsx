import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminAuthProvider } from "@/context/AdminAuthContext";

vi.mock("@/services/admin", () => ({
  adminApi: {
    me: vi.fn(() => Promise.reject(new Error("UNAUTHORIZED"))),
    login: vi.fn(),
    logout: vi.fn(),
  },
}));

function renderWithProviders(ui: ReactNode, initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider>
        <MemoryRouter initialEntries={[initialEntry]}>{ui}</MemoryRouter>
      </AdminAuthProvider>
    </QueryClientProvider>,
  );
}

describe("AdminGuard", () => {
  it("redirige al login cuando no hay sesión", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/admin" element={<AdminGuard />}>
          <Route index element={<p>Panel privado</p>} />
        </Route>
        <Route path="/admin/login" element={<p>Formulario de acceso</p>} />
      </Routes>,
      "/admin",
    );

    expect(await screen.findByText("Formulario de acceso")).toBeInTheDocument();
    expect(screen.queryByText("Panel privado")).not.toBeInTheDocument();
  });
});

describe("AdminLoginPage", () => {
  it("valida los campos antes de enviar credenciales", async () => {
    const { AdminLoginPage } = await import("./AdminLoginPage");

    renderWithProviders(<AdminLoginPage />, "/admin/login");

    fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }));

    await waitFor(() => {
      expect(screen.getByText(/introduce tu contraseña/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/introduce un email válido/i)).toBeInTheDocument();
  });
});
