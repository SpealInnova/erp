const { z } = require("zod");

// Tiempos y KPI: periodo de lo finalizado (lo abierto siempre se incluye).
const tiemposSchema = z.object({
  periodo: z.enum(["trimestre", "anio", "todo"]).default("trimestre"),
});

module.exports = { tiemposSchema };
