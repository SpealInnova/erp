const { z } = require("zod");

const FECHA_ISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado: AAAA-MM-DD");
const vacioComoNulo = (v) => (v === "" ? null : v);
const fechaOpcional = z.preprocess(vacioComoNulo, FECHA_ISO.nullable().optional());
const idOpcional = z.preprocess(
  vacioComoNulo,
  z.union([z.null(), z.coerce.number().int().positive()]).optional()
);
const PRIORIDAD = z.enum(["normal", "alta", "urgente"]);

function fechasEnOrden(datos, ctx) {
  if (datos.fecha_inicio && datos.fecha_fin && datos.fecha_fin < datos.fecha_inicio) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["fecha_fin"],
      message: "La fecha final no puede ser anterior a la de inicio",
    });
  }
}

const crearTareaSchema = z
  .object({
    titulo: z.string().trim().min(1).max(200),
    descripcion: z.preprocess(vacioComoNulo, z.string().max(2000).nullable().optional()),
    // sin responsable, la tarea es de quien la crea
    responsable_id: idOpcional,
    prioridad: PRIORIDAD.default("normal"),
    fecha_inicio: fechaOpcional,
    fecha_fin: fechaOpcional,
    cliente_id: idOpcional,
    proyecto_id: idOpcional,
    documento: z.preprocess(vacioComoNulo, z.string().trim().max(80).nullable().optional()),
  })
  .superRefine(fechasEnOrden);

const actualizarTareaSchema = z
  .object({
    titulo: z.string().trim().min(1).max(200).optional(),
    descripcion: z.preprocess(vacioComoNulo, z.string().max(2000).nullable().optional()),
    responsable_id: z.coerce.number().int().positive().optional(),
    prioridad: PRIORIDAD.optional(),
    // "completada" se muestra como "Finalizado"
    estado: z.enum(["pendiente", "en_curso", "completada"]).optional(),
    fecha_inicio: fechaOpcional,
    fecha_fin: fechaOpcional,
    cliente_id: idOpcional,
    proyecto_id: idOpcional,
    documento: z.preprocess(vacioComoNulo, z.string().trim().max(80).nullable().optional()),
  })
  .superRefine(fechasEnOrden);

const listarTareasSchema = z.object({
  // hoy / semana / mes incluyen también lo vencido y lo que no tiene fechas
  periodo: z.enum(["hoy", "semana", "mes", "vencidas", "todas"]).default("todas"),
  // propias: las creé y son mías; asignadas_por_mi: las creé para otra persona
  origen: z.enum(["todas", "propias", "asignadas_por_mi", "asignadas_a_mi"]).default("todas"),
  estado: z.enum(["abiertas", "finalizadas", "todas"]).default("abiertas"),
});

module.exports = { crearTareaSchema, actualizarTareaSchema, listarTareasSchema };
