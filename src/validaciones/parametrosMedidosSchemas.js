const { z } = require("zod");

const crearParametroSchema = z.object({
  parametro: z.string().min(1),
  unidad: z.string().optional(),
  valor_medido: z.string().optional(),
  valor_esperado: z.string().optional(),
});

const actualizarParametroSchema = crearParametroSchema.partial();

module.exports = { crearParametroSchema, actualizarParametroSchema };
