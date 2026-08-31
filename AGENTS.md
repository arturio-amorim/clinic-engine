# Project Instructions

## Language

Write source identifiers, capability IDs, commits, and public machine errors in English.
Write the README in Brazilian Portuguese.

## Architecture

- Define domain actions as capabilities with explicit input, output, access, and execution contracts.
- Keep the generated direct, CLI, MCP stdio, MCP HTTP entry points on the single `engine.invoke` path.
- Keep calendar providers, clocks, and id factories behind replaceable engine-owned ports.
- Use `defineConnector` for Google Calendar. In-memory calendars, clinic policy, and HTTP bearer authentication are not connectors.
- Keep connector configuration and clients at the composition root; connector construction performs no external I/O.
- Keep business logic out of `src/direct.ts`, `src/cli.ts`, `src/mcp-stdio.ts`, `src/mcp-http.ts`.
- Do not add framework-wide registries, service locators, or adapter-specific business logic.
- Keep HTTP authentication fail-closed: `src/http-auth.ts` verifies `CLINIC_ENGINE_HTTP_TOKEN`.

## Delivery

- Follow RED, GREEN, REFACTOR for executable behavior.
- Run `npm run check` before completing a change.
- Keep `CLAUDE.md` as a symbolic link to this file so agent instructions have one source of truth.
