import { ArrowLeft, Film } from "lucide-react";
import { Link } from "react-router-dom";

import { vintageButtonStyles } from "@/components/common/vintage-button.styles";

export function NotFoundPage() {
  return (
    <section className="container-editorial flex min-h-[60dvh] items-center py-20">
      <div className="max-w-xl">
        <p className="editorial-kicker flex items-center gap-2">
          <Film aria-hidden="true" className="size-4" strokeWidth={1.75} />
          Fotograma 404
        </p>
        <h1 className="mt-4 text-display-md font-semibold">Ese fotograma no existe.</h1>
        <p className="mt-4 text-body text-brown">
          Puede que el enlace esté incompleto o que la página todavía no se haya revelado.
        </p>
        <Link to="/" className={vintageButtonStyles({ className: "mt-8" })}>
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
          Volver al inicio
        </Link>
      </div>
    </section>
  );
}
