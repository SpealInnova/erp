const { z } = require("zod");
const { esquemaListado } = require("./listados");

const TIPOS_SERVICIO = [
  "instalacion",
  "inspeccion",
  "asistencia",
  "mantenimiento_preventivo",
  "mantenimiento_correctivo",
  "garantia",
  "validacion",
];

const crearReporteSchema = z.object({
  equipo_numero_serie: z.string().min(1),
  cliente_id: z.coerce.number().int().positive(),
  proyecto_id: z.coerce.number().int().positive().optional(),
  tipo_servicio: z.enum(TIPOS_SERVICIO),
  en_garantia: z.boolean().optional().default(false),
  motivo: z.string().optional(),
  hallazgos: z.string().optional(),
  recomendaciones: z.string().optional(),
  fecha_servicio: z.string().optional(),
  hora_inicio: z.string().optional(),
  hora_fin: z.string().optional(),
});

const actualizarReporteSchema = crearReporteSchema.partial();

const listarReportesQuerySchema = esquemaListado();

module.exports = { crearReporteSchema, actualizarReporteSchema, listarReportesQuerySchema };
