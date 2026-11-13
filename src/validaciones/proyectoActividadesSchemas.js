const { z } = require("zod");
const { ESTADOS } = require("../dominio/estadoProyecto");

const FECHA_ISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado: AAAA-MM-DD");

const crearActividadSchema = z.object({
  categoria: z.string().min(1),
  descripcion: z.string().min(1),
  responsable_id: z.coerce.number().int().positive().optional(),
  fase: z.nativeEnum(ESTADOS).optional(),
});

const actualizarActividadSchema = z
  .object({
    categoria: z.string().min(1).optional(),
    descripcion: z.string().min(1).optional(),
    // null quita el responsable ("— Sin asignar —").
    responsable_id: z.union([z.null(), z.coerce.number().int().positive()]).optional(),
    estado: z.enum(["pendiente", "completada"]).optional(),
    fecha_inicio: FECHA_ISO.optional(),
    fecha_fin: FECHA_ISO.optional(),
  })
  .superRefine((datos, ctx) => {
    if (datos.fecha_inicio && datos.fecha_fin && datos.fecha_fin < datos.fecha_inicio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fecha_fin"],
        message: "La fecha final no puede ser anterior a la fecha de inicio",
      });
    }
  });

module.exports = { crearActividadSchema, actualizarActividadSchema };
