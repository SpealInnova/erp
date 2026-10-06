const { z } = require("zod");

const crearCambioSchema = z.object({
  fecha: z.string().optional(),
  descripcion: z.string().optional(),
  motivo: z.string().optional(),
  estado: z.enum(["pendiente", "aprobado", "rechazado"]).optional(),
});

const actualizarCambioSchema = crearCambioSchema.partial();

module.exports = { crearCambioSchema, actualizarCambioSchema };
