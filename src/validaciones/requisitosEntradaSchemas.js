const { z } = require("zod");

const crearRequisitoSchema = z.object({
  requisito: z.string().min(1),
  valor: z.string().optional(),
  fuente: z.string().optional(),
  criterio_aceptacion: z.string().optional(),
  evidencia: z.string().optional(),
  cumple: z.enum(["si", "no"]).optional(),
});

const actualizarRequisitoSchema = crearRequisitoSchema.partial();

module.exports = { crearRequisitoSchema, actualizarRequisitoSchema };
