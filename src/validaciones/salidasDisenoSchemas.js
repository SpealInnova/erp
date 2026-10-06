const { z } = require("zod");

const crearSalidaSchema = z.object({
  salida: z.string().min(1),
  codigo_version: z.string().optional(),
  responsable_id: z.coerce.number().int().positive(),
  fecha: z.string().optional(),
  estado: z.string().optional(),
});

const actualizarSalidaSchema = crearSalidaSchema.partial();

module.exports = { crearSalidaSchema, actualizarSalidaSchema };
