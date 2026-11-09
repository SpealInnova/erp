const { z } = require("zod");

const TABLAS_PERMITIDAS = ["proyectos", "proyecto_actividades", "requisiciones", "ordenes_compra"];

const subirArchivoSchema = z.object({
  tabla: z.enum(TABLAS_PERMITIDAS),
  registro_id: z.coerce.number().int().positive(),
});

const listarArchivosQuerySchema = z.object({
  tabla: z.enum(TABLAS_PERMITIDAS),
  registro_id: z.coerce.number().int().positive(),
});

module.exports = { TABLAS_PERMITIDAS, subirArchivoSchema, listarArchivosQuerySchema };
