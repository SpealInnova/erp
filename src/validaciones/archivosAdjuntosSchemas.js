const { z } = require("zod");

// Documentos que admiten evidencias. Para agregar uno: aquí, en
// VERIFICADORES_POR_TABLA (servicios/archivosAdjuntos) y en
// resolverProyectoYFase (servicios/proyectoCarpetasDrive).
const TABLAS_PERMITIDAS = [
  "proyectos",
  "proyecto_actividades",
  "requisiciones",
  "ordenes_compra",
  "reportes_servicio_tecnico",
  "actas_entrega_equipos",
  "actas_cierre_satisfaccion",
];

const subirArchivoSchema = z.object({
  tabla: z.enum(TABLAS_PERMITIDAS),
  registro_id: z.coerce.number().int().positive(),
});

const listarArchivosQuerySchema = z.object({
  tabla: z.enum(TABLAS_PERMITIDAS),
  registro_id: z.coerce.number().int().positive(),
});

module.exports = { TABLAS_PERMITIDAS, subirArchivoSchema, listarArchivosQuerySchema };
