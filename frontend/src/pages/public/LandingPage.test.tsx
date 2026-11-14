import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { LandingPage } from "./LandingPage";

describe("LandingPage", () => {
  it("presenta la propuesta y un enlace funcional a cómo funciona", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: /los recuerdos se revelan juntos/i }),
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /descubrir cómo funciona/i })).toHaveAttribute(
      "href",
      "/#como-funciona",
    );
  });

  it("muestra la sección de privacidad y el estado de la fase", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /privado por defecto/i })).toBeInTheDocument();
    expect(screen.getByText(/fase 4 de 7/i)).toBeInTheDocument();
  });
});
