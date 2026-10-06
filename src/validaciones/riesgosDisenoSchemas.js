const { z } = require("zod");

const crearRiesgoSchema = z.object({
  peligro: z.string().min(1),
  situacion_peligrosa: z.string().optional(),
  dano_potencial: z.string().optional(),
  severidad: z.string().optional(),
  probabilidad: z.string().optional(),
  control: z.string().optional(),
  responsable_id: z.coerce.number().int().positive(),
});

const actualizarRiesgoSchema = crearRiesgoSchema.partial();

module.exports = { crearRiesgoSchema, actualizarRiesgoSchema };
