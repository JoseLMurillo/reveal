import type { ReactNode } from "react";

export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="border-b border-border pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="editorial-kicker">{kicker}</p>
          <h1 className="mt-2 text-heading-lg font-semibold tracking-[-0.01em] sm:text-[2.4rem]">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-body-sm text-brown">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
