# Rollo — álbum fotográfico colectivo

Rollo es una aplicación web para recopilar fotografías durante un evento con una dinámica inspirada en las cámaras desechables y los rollos de 35 mm: cada invitado recibe un número limitado de disparos por día, sube sus fotos desde el navegador y, al finalizar el evento, el administrador genera un álbum colectivo.

> **Estado actual: Fases 0–6 implementadas; pendiente la validación final de la Fase 7.**
> El monorepo incluye autenticación administrativa propia con sesiones y CSRF, dashboard, CRUD de eventos, portada en Storage, QR PNG/SVG, creación individual y masiva de participantes, enlaces personales de una sola visualización, canje y auto-registro con cupo atómico, cuotas diarias/totales con reinicio en la zona horaria del evento, subida directa a Storage con progreso real, validación de imágenes con `file-type` y `sharp`, galería personal, gestión administrativa de fotos, worker de limpieza, galería colectiva, álbum editorial por días, exportación ZIP en streaming, votación anónima de la mejor fotografía del día y una capa visual responsive con animaciones respetuosas de `prefers-reduced-motion`.

## Documentación

| Documento                                                        | Contenido                                                         |
| ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)                     | Arquitectura, flujos, identidad, cuotas, reservas y riesgos       |
| [docs/DATABASE.md](docs/DATABASE.md)                             | Modelo relacional, restricciones, índices, RLS y funciones RPC    |
| [docs/API.md](docs/API.md)                                       | Contrato REST, autenticación, errores y endpoints                 |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)                   | Identidad visual, tokens, componentes, movimiento y accesibilidad |
| [docs/SECURITY.md](docs/SECURITY.md)                             | Modelo de amenazas y controles de seguridad                       |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)                         | Supabase, Render, Vercel, migraciones y variables de entorno      |
| [docs/DEVELOPMENT_PHASES.md](docs/DEVELOPMENT_PHASES.md)         | Fases, entregables, criterios de aceptación y pruebas             |
| [docs/TASKS.md](docs/TASKS.md)                                   | Plan de tareas accionable por fase                                |
| [docs/DECISIONS.md](docs/DECISIONS.md)                           | Registro de decisiones de arquitectura (ADR)                      |
| [database/README.md](database/README.md)                         | Migraciones, seeds y verificación local                           |
| [CONTRIBUTING.md](CONTRIBUTING.md)                               | Flujo de trabajo, commits y reglas del proyecto                   |

## Stack

- **Frontend:** React 19, Vite, TypeScript, React Router, Tailwind CSS, Motion, Lucide React, TanStack Query, React Hook Form, Zod.
- **Backend:** Node.js 22, Express, TypeScript, CORS, Helmet, dotenv, Pino, Supabase JS SDK, Zod.
- **Datos e infraestructura:** Supabase (PostgreSQL y Storage), Vercel (frontend), Render (backend).

La autenticación es propia: no se usa Supabase Auth. Los administradores viven en `admin_users` con contraseñas Argon2id y sesiones opacas en PostgreSQL. Los participantes usan códigos de acceso revocables y sesiones con token hasheado.

## Estructura

```text
rollo/
├── frontend/          # Aplicación React + Vite
├── backend/           # API Express + TypeScript
├── shared/            # Contratos compartidos (tipos, enums y esquemas Zod)
├── database/
│   ├── migrations/    # Migraciones SQL versionadas
│   ├── scripts/       # create-admin y verificación de migraciones
│   └── seeds/         # Seed de desarrollo sin contraseñas
├── docs/
├── .github/           # CI y plantilla de Pull Request
├── .opencode/         # Skill de diseño UI/UX instalada para el agente
├── .gitignore
└── README.md
```

`shared/` evita que los contratos entre frontend y backend se desincronicen. Su justificación está en [docs/DECISIONS.md](docs/DECISIONS.md).

## Requisitos

- Node.js 22 LTS o superior.
- npm 10 o superior.
- Un proyecto Supabase para desarrollo real (PostgreSQL + Storage).
- Opcional: Supabase CLI y Docker para aplicar migraciones en local.
- Opcional: PGlite (incluido como dependencia) para verificar migraciones sin Docker.

## Instalación local

```bash
npm install

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edita `backend/.env` con los datos de tu proyecto Supabase. Las variables más importantes:

| Variable                    | Descripción                                                       |
| --------------------------- | ----------------------------------------------------------------- |
| `SUPABASE_URL`              | URL del proyecto Supabase.                                        |
| `SUPABASE_ANON_KEY`         | Puede contener la **secret key** (`sb_secret_...`). Solo backend. |
| `SUPABASE_SERVICE_ROLE_KEY` | Alternativa a la secret key si usas la clave clásica. Opcional.   |
| `SUPABASE_STORAGE_BUCKET`   | Bucket privado. Por defecto `rollo-originals`.                    |
| `FRONTEND_URL`              | Origen permitido por CORS, por ejemplo `http://localhost:5173`.   |
| `TRUST_PROXY`               | Configuración de proxy de Express (`1` en Render).                |

En `frontend/.env` solo se define `VITE_API_URL`. **Ninguna clave de Supabase se coloca en el frontend.**

Para desplegar: el backend lee `SUPABASE_URL` y una única clave de servidor
(`SUPABASE_ANON_KEY` con la secret key o `SUPABASE_SERVICE_ROLE_KEY`). El
frontend usa el proxy `/api` de Vercel y no necesita claves de Supabase.

### Aplicar migraciones

Con Supabase CLI:

```bash
supabase link --project-ref <ref>
supabase db push
```

Sin Docker, todas las migraciones se pueden validar en PostgreSQL WASM:

```bash
npm run db:verify
```

Esta verificación aplica las 13 migraciones y prueba registro con cupo, canje de códigos, cuotas, confirmación idempotente, liberación, expiración, triggers y privilegios de RLS. No sustituye una prueba contra Supabase real (el esquema `storage` no existe en PGlite).

### Crear el primer administrador

```bash
npm run admin:create -- --email admin@example.com --name "Administrador"
```

El comando pide la contraseña de forma interactiva, la hashea con Argon2id y crea el rol `owner`. Para recuperar una contraseña:

```bash
npm run admin:reset-password -- admin@example.com
```

El reset revoca todas las sesiones del administrador. No existe registro público de administradores.

### Desarrollo

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000`
- Health: `GET /health`
- Readiness: `GET /health/ready`

`npm run dev` compila `shared/` y arranca los tres workspaces con recarga en caliente.

## Scripts

| Comando              | Acción                                                     |
| -------------------- | ---------------------------------------------------------- |
| `npm run dev`        | Compila `shared` y arranca frontend, backend y contratos.   |
| `npm run build`      | Build de producción de los tres workspaces.                |
| `npm run typecheck`  | TypeScript estricto en todos los workspaces.               |
| `npm run lint`       | ESLint en todo el repositorio.                             |
| `npm run format`     | Prettier sobre el repositorio.                             |
| `npm run format:check` | Comprueba el formato sin escribir.                       |
| `npm test`           | Pruebas de workspaces + verificación de migraciones.       |
| `npm run db:verify`  | Aplica migraciones y prueba las RPC en PGlite.             |
| `npm run admin:create` | Crea el primer administrador o recupera su contraseña.   |
| `npm run rls:verify` | Comprueba RLS contra un Supabase configurado.              |

## Principios del producto

1. **La cuota es del servidor.** El frontend informa, pero PostgreSQL decide.
2. **Los originales no se tocan.** La estética analógica se aplica a la interfaz, nunca a los archivos.
3. **La identidad anónima es real.** Todo participante tiene un identificador interno y un token seguro, aunque no escriba su nombre.
4. **Los álbumes son privados por defecto.** La publicación es una decisión explícita del administrador.
5. **Nada de almacenamiento local en Render.** Las fotografías viven en Supabase Storage.

## Limitaciones conocidas

- Las migraciones, RPC y privilegios se verificaron en PGlite y la conexión real de base/Storage respondió correctamente; falta una prueba E2E completa con fotos y usuarios reales.
- La concurrencia del cupo de participantes y de la cuota se probó en PGlite; falta repetirla contra PostgreSQL/Supabase real.
- El CRUD administrativo y el panel de participantes se probaron con repositorios en memoria y mocks de API; falta ejecutarlos contra PostgREST/Supabase real.
- La subida de portada y de fotografías requiere CORS correcto en el bucket de Supabase para el dominio del panel.
- La validación de MIME real, decodificación y limpieza de Storage se probó con dobles en memoria; falta ejecutarla contra un bucket Supabase real.
- La exportación ZIP y las URLs firmadas del álbum se probaron con Storage simulado; falta validarlas con un bucket Supabase real.
- La votación anónima se probó en PGlite y con repositorios en memoria; falta una prueba de concurrencia contra PostgreSQL real.
- `frontend/vercel.json` contiene `https://rollo-api.onrender.com` como destino provisional del proxy; debe sustituirse al desplegar.
- El build del frontend supera el umbral de 500 kB en un único chunk; la división de rutas queda pendiente para una fase de rendimiento.
- `npm audit` reporta vulnerabilidades en dependencias de desarrollo (Vitest y tooling) y una advertencia de Zod 3 sin corrección compatible sin salto de versión mayor. No hay exposición directa en producción; se revisará al planificar la actualización.

## Advertencias de privacidad

- La identidad anónima de un participante está vinculada al navegador/dispositivo donde se guarda su token. Si borra los datos del navegador, usa modo incógnito o cambia de dispositivo, **no podrá recuperar esa identidad ni sus fotografías**. Podrá volver a participar, pero como un participante nuevo y con una cuota nueva.
- Las fotografías se almacenan en un bucket privado y se sirven mediante URLs firmadas de corta duración.
- La clave `SUPABASE_SERVICE_ROLE_KEY` vive únicamente en el backend. Nunca debe exponerse en el frontend ni dentro de un código QR.
- El frontend no recibe ninguna clave de Supabase: sube directamente a las URLs firmadas que emite el backend.
- La votación es anónima: la identidad interna del votante solo se usa para evitar votos duplicados y nunca se devuelve en la API ni en el panel. Solo se publican los totales por foto y el ranking del día.
