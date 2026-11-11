const { z } = require("zod");
const { ESTADOS } = require("../dominio/estadoProyecto");

const crearProyectoSchema = z.object({
  cliente_id: z.coerce.number().int().positive(),
  responsable_id: z.coerce.number().int().positive(),
  nombre_proyecto: z.string().min(1),
  linea_negocio: z.string().optional(),
  cotizacion_id: z.coerce.number().int().positive().optional(),
  presupuesto_estimado: z.coerce.number().nonnegative().optional(),
});

const actualizarProyectoSchema = z.object({
  codigo_pry: z
    .string()
    .regex(/^PRY-\d{4}-\d{3}$/, "Formato esperado: PRY-AAAA-NNN")
    .optional(),
  nombre_proyecto: z.string().min(1).optional(),
  linea_negocio: z.string().optional(),
  responsable_id: z.coerce.number().int().positive().optional(),
  cotizacion_id: z.coerce.number().int().positive().optional(),
  presupuesto_estimado: z.coerce.number().nonnegative().optional(),
});

const eliminarProyectoSchema = z.object({
  password: z.string().min(1),
  justificacion: z.string().min(1),
});

const cambiarEstadoSchema = z.object({
  estado: z.nativeEnum(ESTADOS),
  observacion: z.string().min(1).optional(),
});

const listarProyectosQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).optional().default(1),
  tamanoPagina: z.coerce.number().int().min(1).max(100).optional().default(20),
});

module.exports = {
  crearProyectoSchema,
  actualizarProyectoSchema,
  eliminarProyectoSchema,
  cambiarEstadoSchema,
  listarProyectosQuerySchema,
};
