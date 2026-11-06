const { z } = require("zod");

const crearActividadSchema = z.object({
  categoria: z.string().min(1),
  descripcion: z.string().min(1),
  responsable_id: z.coerce.number().int().positive().optional(),
});

const actualizarActividadSchema = z.object({
  categoria: z.string().min(1).optional(),
  descripcion: z.string().min(1).optional(),
  responsable_id: z.coerce.number().int().positive().optional(),
  estado: z.enum(["pendiente", "completada"]).optional(),
});

module.exports = { crearActividadSchema, actualizarActividadSchema };
