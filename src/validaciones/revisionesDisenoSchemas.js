const { z } = require("zod");

const crearRevisionSchema = z.object({
  fecha: z.string().optional(),
  hallazgos: z.string().optional(),
  acciones: z.string().optional(),
  responsable_id: z.coerce.number().int().positive(),
  cierre: z.enum(["si", "no"]).optional(),
});

const actualizarRevisionSchema = crearRevisionSchema.partial();

module.exports = { crearRevisionSchema, actualizarRevisionSchema };
