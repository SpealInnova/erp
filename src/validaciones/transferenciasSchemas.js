const { z } = require("zod");

const crearTransferenciaSchema = z.object({
  elemento_transferido: z.string().min(1),
  area_receptora: z.string().optional(),
  responsable_id: z.coerce.number().int().positive(),
  fecha: z.string().optional(),
  cumple: z.enum(["si", "no"]).optional(),
});

const actualizarTransferenciaSchema = crearTransferenciaSchema.partial();

module.exports = { crearTransferenciaSchema, actualizarTransferenciaSchema };
