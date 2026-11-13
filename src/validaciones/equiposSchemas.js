const { z } = require("zod");

const crearEquipoSchema = z.object({
  numero_serie: z.string().trim().min(1),
  cliente_id: z.coerce.number().int().positive(),
  proyecto_id: z.coerce.number().int().positive(),
  descripcion: z.string().trim().min(1),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  fecha_instalacion: z.string().optional(),
});

const actualizarEquipoSchema = crearEquipoSchema.partial();

const listarEquiposQuerySchema = z.object({
  cliente_id: z.coerce.number().int().positive().optional(),
  proyecto_id: z.coerce.number().int().positive().optional(),
  numero_serie: z.string().trim().min(1).optional(),
});

module.exports = { crearEquipoSchema, actualizarEquipoSchema, listarEquiposQuerySchema };
