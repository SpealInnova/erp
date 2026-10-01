const { z } = require("zod");

const crearValidacionSchema = z.object({
  aspecto_validado: z.string().min(1),
  metodo: z.string().optional(),
  condicion_prueba: z.string().optional(),
  resultado: z.string().optional(),
});

const actualizarValidacionSchema = crearValidacionSchema.partial();

module.exports = { crearValidacionSchema, actualizarValidacionSchema };
