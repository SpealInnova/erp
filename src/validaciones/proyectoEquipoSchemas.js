const { z } = require("zod");

const agregarMiembroSchema = z.object({
  usuario_id: z.coerce.number().int().positive(),
  rol_en_proyecto: z.string().min(1),
});

module.exports = { agregarMiembroSchema };
