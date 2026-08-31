# clinic-engine

Action Engine de agendamento da **Clínica Horizonte**.

O agente (Claude, ChatGPT, Cursor, um app ou a CLI) só pede o resultado. A política da clínica — expediente, buffer, aviso mínimo e quem atende o quê — mora aqui, uma vez, e todo mundo passa por `engine.invoke`.

```
paciente / recepção / agente
        ↓
appointments.list-valid-slots
appointments.schedule
appointments.reschedule
appointments.cancel
        ↓
política da clínica + calendário
        ↓
horário válido, consulta marcada, ou recusa estável
```

## O que este engine faz

| Capability | Quem pode chamar | Resultado |
|---|---|---|
| `appointments.list-valid-slots` | público | Horários que a clínica permite oferecer |
| `appointments.schedule` | autenticado | Consulta confirmada ou conflito estável |
| `appointments.reschedule` | autenticado | Novo horário, se o aviso mínimo permitir |
| `appointments.cancel` | autenticado | Cancelamento, se o aviso mínimo permitir |

A clínica de demonstração:

- **Expediente:** segunda a sexta, 08:00–18:00; sábado, 08:00–12:00; domingo fechado
- **Fuso:** `America/Sao_Paulo` (`-03:00`)
- **Buffer:** 10 minutos entre consultas
- **Aviso mínimo:** 2 horas para marcar, remarcar ou cancelar
- **Profissionais:** Dra. Ana Souza (`consulta-geral`, `retorno`) e Dr. Carlos Mendes (`consulta-geral`, `exame`)

O calendário padrão é **em memória**, com duas consultas já marcadas no dia `2026-09-07`, para o README e os testes serem determinísticos. O relógio padrão também está congelado nesse dia. Trocar para relógio real ou Google Calendar é só injetar outra dependência — as capabilities não mudam.

## Requisitos

- Node.js 22.20 ou posterior

## Primeiro run

```sh
npm install
npm run check
npm run direct
```

`npm run check` typecheck, testa, builda e valida o catálogo MCP. `npm run direct` lista horários de `consulta-geral` no dia de demonstração.

## CLI

A CLI entra como a recepção local (`local:clinic-desk`), então as actions autenticadas funcionam.

```sh
npm run build

npm run cli -- list

npm run cli -- run appointments.list-valid-slots --input '{"appointmentType":"consulta-geral","date":"2026-09-07"}'

npm run cli -- run appointments.schedule --input '{
  "patientName": "Ada Lovelace",
  "appointmentType": "consulta-geral",
  "practitionerId": "dra-ana-souza",
  "start": "2026-09-07T14:00:00-03:00"
}'
```

## MCP stdio

```sh
npm run mcp:stdio
npm run mcp:install
```

Depois o Cursor, Claude Code ou outro cliente MCP local vê as quatro tools. `mcp:uninstall` remove o engine dos clientes gerenciados pelo Senda.

## MCP HTTP

1. Copie `.env.example` para `.env`
2. Defina `CLINIC_ENGINE_HTTP_TOKEN`
3. Suba o servidor:

```sh
cp .env.example .env
npm run mcp:http
```

O endpoint é `POST http://127.0.0.1:3000/mcp`. Sem `Authorization: Bearer <token>` a resposta é 401. Não existe modo de desenvolvimento sem autenticação.

## Devtools

```sh
npm run devtools
```

Abre o inspector do Senda (em geral em http://localhost:4100/). Dá para chamar a mesma capability por direct, CLI, MCP stdio ou MCP HTTP e comparar o resultado.

## Como a fronteira funciona

- **MCP, CLI e HTTP são tomadas.** Eles não conhecem Google Calendar nem a regra de sábado.
- **O Action Engine é o microsserviço de domínio.** Ele valida entrada, autoriza, aplica a política e só então fala com o calendário.
- **Google Calendar é um adapter.** `src/infrastructure/google-calendar.ts` implementa o mesmo `CalendarPort` da agenda em memória via `defineConnector`. O default não chama a API do Google, para o clone do repositório funcionar sem credencial.

Para usar Google Calendar no composition root:

```ts
import { googleCalendarConnector } from "./infrastructure/google-calendar.js";

const { ports } = googleCalendarConnector.create(
  {
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    accessToken: process.env.GOOGLE_CALENDAR_ACCESS_TOKEN,
  },
  {},
);

export const engine = createClinicEngine({
  calendar: ports.calendar,
  clock: { now: () => new Date() },
  createId: createIdFactory(),
});
```

## Mapa do projeto

```
src/capabilities/     contratos públicos (input, output, access, run)
src/domain/           política da clínica e geração de slots
src/application/      CalendarPort e dependências
src/infrastructure/   agenda em memória e conector Google
src/engine.ts         um mapa de capabilities, um invoke
src/direct.ts         smoke test
src/cli.ts            CLI
src/mcp-stdio.ts      MCP local
src/mcp-http.ts       MCP Streamable HTTP
test/                 provas pela fronteira engine.invoke
```

## Próximos nichos

Este repo é o primeiro de uma série. O mesmo padrão serve para reembolso de e-commerce, proposta comercial, triagem de candidatos, etc.: um engine por domínio, várias tomadas, uma política.

## Licença

MIT
