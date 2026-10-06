const { z } = require("zod");
const { ESTADOS } = require("../dominio/estadoProyecto");

const crearProyectoSchema = z.object({
  cliente_id: z.coerce.number().int().positive(),
  responsable_id: z.coerce.number().int().positive(),
  nombre_proyecto: z.string().min(1),
  linea_negocio: z.string().optional(),
  cotizacion_id: z.coerce.number().int().positive().optional(),
});

const actualizarProyectoSchema = z.object({
  nombre_proyecto: z.string().min(1).optional(),
  linea_negocio: z.string().optional(),
  responsable_id: z.coerce.number().int().positive().optional(),
  cotizacion_id: z.coerce.number().int().positive().optional(),
});

const cambiarEstadoSchema = z.object({
  estado: z.nativeEnum(ESTADOS),
});

const listarProyectosQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).optional().default(1),
  tamanoPagina: z.coerce.number().int().min(1).max(100).optional().default(20),
});

module.exports = {
  crearProyectoSchema,
  actualizarProyectoSchema,
  cambiarEstadoSchema,
  listarProyectosQuerySchema,
};
