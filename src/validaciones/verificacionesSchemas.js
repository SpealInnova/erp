const { z } = require("zod");

const crearVerificacionSchema = z.object({
  requisito_verificado: z.string().min(1),
  metodo: z.string().optional(),
  criterio: z.string().optional(),
  resultado: z.string().optional(),
  evidencia: z.string().optional(),
});

const actualizarVerificacionSchema = crearVerificacionSchema.partial();

module.exports = { crearVerificacionSchema, actualizarVerificacionSchema };
