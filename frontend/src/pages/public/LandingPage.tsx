import {
  ArrowDown,
  BookOpen,
  Camera,
  Check,
  Images,
  LockKeyhole,
  QrCode,
  Sparkles,
} from "lucide-react";
import { motion, type Variants } from "motion/react";

import { FilmStrip } from "@/components/common/FilmStrip";
import { vintageButtonStyles } from "@/components/common/vintage-button.styles";

const EASE = [0.22, 1, 0.36, 1] as const;

const stagger: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.09, delayChildren: 0.05 },
  },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE },
  },
};

const steps = [
  {
    number: "01",
    icon: QrCode,
    title: "Recibes tu enlace",
    body: "El organizador comparte un QR para el evento. Al abrirlo eliges tu nombre o participas de forma anónima. Sin cuentas ni aplicaciones.",
  },
  {
    number: "02",
    icon: Camera,
    title: "Disparas con límite",
    body: "Cada persona tiene un número de fotografías por día. La cuota se renueva a medianoche según la zona horaria del evento y se calcula en el servidor.",
  },
  {
    number: "03",
    icon: BookOpen,
    title: "Se revela el álbum",
    body: "Al terminar, todas las miradas se ordenan por días en un álbum editorial. Los originales se conservan intactos, sin filtros ni recortes.",
  },
] as const;

const privacyPoints = [
  "La galería puede ser privada, solo para invitados o pública. La decides tú.",
  "Las fotografías viven en un almacenamiento privado y se sirven con enlaces temporales.",
  "Los nombres solo aparecen en el álbum cuando el organizador lo permite.",
  "Las imágenes originales nunca se modifican, recomprimen ni recortan de forma permanente.",
] as const;

export function LandingPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-10 hidden size-72 rounded-full border border-brown/10 lg:block"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 top-24 hidden size-48 rounded-full border border-brown/15 lg:block"
        />

        <div className="container-editorial grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16 lg:py-24">
          <motion.div variants={stagger} initial="hidden" animate="visible">
            <motion.p variants={rise} className="editorial-kicker flex items-center gap-3">
              <span aria-hidden="true" className="h-px w-8 bg-brown" />
              Fotografía colectiva para eventos
            </motion.p>

            <motion.h1
              variants={rise}
              className="mt-5 max-w-[13ch] text-display-lg font-semibold leading-[0.98] text-ink sm:text-display-xl"
            >
              Los recuerdos <span className="italic text-brown">se revelan</span> juntos.
            </motion.h1>

            <motion.p
              variants={rise}
              className="mt-6 max-w-reading text-body-lg text-brown sm:text-[1.2rem]"
            >
              Un rollo para cada celebración. Tus invitados reciben un número limitado de disparos,
              suben sus fotos desde el navegador y, al final, todas las miradas se convierten en un
              álbum compartido.
            </motion.p>

            <motion.div variants={rise} className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="/#como-funciona"
                className={vintageButtonStyles({ variant: "primary", size: "lg" })}
              >
                Descubrir cómo funciona
                <ArrowDown aria-hidden="true" className="size-4" strokeWidth={2} />
              </a>
              <span className="font-mono text-caption uppercase tracking-[0.14em] text-muted">
                Sin apps · Sin cuentas
              </span>
            </motion.div>

            <motion.dl
              variants={rise}
              className="mt-10 grid max-w-lg grid-cols-1 gap-px border-y border-border bg-border sm:grid-cols-3"
            >
              {[
                ["Cuota justa", "Por persona y día"],
                ["Originales", "Intactos, sin filtros"],
                ["Móvil primero", "Pensado para una mano"],
              ].map(([term, description]) => (
                <div key={term} className="bg-paper px-4 py-4">
                  <dt className="font-mono text-caption uppercase tracking-[0.12em] text-ink">
                    {term}
                  </dt>
                  <dd className="mt-1 text-body-sm text-brown">{description}</dd>
                </div>
              ))}
            </motion.dl>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24, rotate: 1.2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: EASE }}
            className="relative mx-auto w-full max-w-md lg:max-w-none"
          >
            <div
              aria-hidden="true"
              className="absolute -left-3 -top-3 hidden h-16 w-16 border-l border-t border-brown/40 sm:block"
            />
            <FilmStrip />
            <div className="mt-4 flex items-center justify-between gap-4 border-b border-border pb-3 font-mono text-caption uppercase tracking-[0.14em] text-muted">
              <span>Un rollo compartido</span>
              <span className="flex items-center gap-1.5 text-brown">
                <Images aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
                24 exposiciones
              </span>
            </div>
            <p className="mt-3 text-body-sm text-brown">
              Una dinámica inspirada en las cámaras desechables: espera, dispara y descubre lo que
              salió cuando todos hayan terminado.
            </p>
          </motion.div>
        </div>
      </section>

      <section id="como-funciona" className="scroll-mt-8 py-16 sm:py-24">
        <div className="container-editorial">
          <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
            <div>
              <p className="editorial-kicker">El mecanismo</p>
              <h2 className="mt-4 max-w-md text-display-md font-semibold">
                Tres gestos. Un álbum.
              </h2>
              <p className="mt-5 max-w-sm text-body text-brown">
                La tecnología desaparece para dejar sitio a lo importante: mirar, elegir y compartir
                el recuerdo.
              </p>
            </div>

            <div className="grid gap-4">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <motion.article
                    key={step.number}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.5, delay: index * 0.06, ease: EASE }}
                    className="paper-card grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:p-6"
                  >
                    <div className="flex items-center gap-4 sm:block">
                      <span
                        aria-hidden="true"
                        className="grid size-12 place-items-center rounded-sm border border-brown/35 bg-cream/45 text-brown"
                      >
                        <Icon className="size-5" strokeWidth={1.75} />
                      </span>
                    </div>
                    <div>
                      <div className="flex items-baseline justify-between gap-4">
                        <h3 className="text-heading-sm font-semibold">{step.title}</h3>
                        <span
                          aria-hidden="true"
                          className="font-mono text-caption tracking-[0.14em] text-border"
                        >
                          {step.number}
                        </span>
                      </div>
                      <p className="mt-2 max-w-xl text-body-sm text-brown">{step.body}</p>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-ink py-16 text-paper-raised sm:py-20">
        <div
          aria-hidden="true"
          className="film-perforation absolute inset-x-0 top-0 h-3 opacity-20"
        />
        <div
          aria-hidden="true"
          className="film-perforation absolute inset-x-0 bottom-0 h-3 opacity-20"
        />
        <div className="container-editorial grid gap-8 md:grid-cols-[0.55fr_1.45fr] md:items-end">
          <p className="font-mono text-caption uppercase tracking-[0.18em] text-yellow">
            Manifiesto Rollo
          </p>
          <blockquote className="max-w-4xl">
            <p className="text-balance font-display text-[clamp(1.9rem,5vw,3.8rem)] font-medium leading-[1.06] tracking-[-0.02em] text-paper-raised">
              Una sola mirada no cuenta una historia.{" "}
              <span className="italic text-yellow">Cien miradas sí.</span>
            </p>
            <footer className="mt-6 flex items-center gap-2 font-mono text-caption uppercase tracking-[0.14em] text-paper-raised/60">
              <Sparkles aria-hidden="true" className="size-3.5 text-yellow" strokeWidth={1.75} />
              Lo que no se posa también merece ser recordado
            </footer>
          </blockquote>
        </div>
      </section>

      <section id="privacidad" className="scroll-mt-8 py-16 sm:py-24">
        <div className="container-editorial grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div>
            <p className="editorial-kicker">Privacidad</p>
            <h2 className="mt-4 text-display-md font-semibold">Privado por defecto.</h2>
            <p className="mt-5 max-w-md text-body text-brown">
              Un álbum familiar no es un escaparate. Rollo parte de una configuración conservadora y
              convierte la publicación en una decisión explícita.
            </p>
            <div className="mt-7 inline-flex items-center gap-2 rounded-sm border border-brown/30 bg-cream/50 px-3 py-2 font-mono text-caption uppercase tracking-[0.12em] text-brown">
              <LockKeyhole aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
              Bucket privado · URLs firmadas
            </div>
          </div>

          <ul className="grid gap-3">
            {privacyPoints.map((point) => (
              <li key={point} className="paper-card flex gap-4 p-5">
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-success/35 bg-success/10 text-success"
                >
                  <Check className="size-3.5" strokeWidth={2.4} />
                </span>
                <p className="text-body-sm text-brown">{point}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="pb-20 sm:pb-28">
        <div className="container-editorial">
          <div className="paper-card relative overflow-hidden p-7 sm:p-10 lg:p-12">
            <div
              aria-hidden="true"
              className="absolute -right-16 -top-16 size-48 rounded-full border border-brown/10"
            />
            <p className="editorial-kicker">El siguiente rollo</p>
            <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
              <h2 className="max-w-2xl text-display-md font-semibold">
                Cada celebración merece más de una mirada.
              </h2>
              <div>
                <p className="max-w-sm text-body-sm text-brown">
                  La creación de eventos y la experiencia de invitados se están construyendo por
                  fases. Esta es la fundación técnica: sin promesas vacías ni botones que no hacen
                  nada.
                </p>
                <p className="mt-4 font-mono text-caption uppercase tracking-[0.14em] text-muted">
                  Fase 4 de 7 · Carga y gestión de fotografías
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
