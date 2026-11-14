# Guía de contribución

## Flujo de trabajo

1. Trabaja en una rama corta: `feat/fase-2-login`, `fix/csrf-origin`, `docs/rls`.
2. No avances a una fase posterior sin aprobación explícita.
3. Antes de abrir un Pull Request ejecuta:

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

## Convención de commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```text
<tipo>(<alcance opcional>): <descripción en imperativo>
```

Tipos permitidos: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `build`, `ci`, `perf`.

Ejemplos:

```text
feat(api): añadir login administrativo con cookie HttpOnly
fix(db): impedir reservas por encima de la cuota diaria
docs(deployment): documentar variables de Render
```

## Reglas del proyecto

- Sin `any`, sin `@ts-ignore` y sin silenciar errores de TypeScript.
- Sin SQL en React. Todo acceso a datos pasa por la API.
- Sin secretos en el repositorio; usa los `.env.example` como plantilla.
- Sin funcionalidades simuladas ni botones sin acción.
- Los originales de las fotos nunca se alteran.
- La cuota se valida y reserva transaccionalmente en PostgreSQL.
- Las migraciones aplicadas no se editan: se crea una nueva.
- Toda funcionalidad incluye pruebas y documentación.

## Base de datos

- Migraciones: `database/migrations/`.
- Verificación local sin Docker: `npm run db:verify` (PGlite).
- La verificación con PGlite no sustituye la prueba contra Supabase real.
- El bucket `rollo-originals` es privado y no tiene políticas para `anon` ni
  `authenticated`.

## Seguridad

- `SUPABASE_SERVICE_ROLE_KEY` solo vive en el backend.
- Nunca registres contraseñas, tokens, códigos de acceso ni URLs firmadas.
- Los códigos de acceso y tokens se guardan únicamente como hash SHA-256.
- Las contraseñas administrativas usan Argon2id.
