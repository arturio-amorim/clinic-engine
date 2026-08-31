import { engine } from "./engine.js";

const result = await engine.invoke(
  "appointments.list-valid-slots",
  { appointmentType: "consulta-geral", date: "2026-09-07" },
  { source: "direct", principal: null },
);

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
