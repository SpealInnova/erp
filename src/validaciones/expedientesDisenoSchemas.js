const { z } = require("zod");
const { ESTADOS } = require("../dominio/estadoExpedienteDiseno");

const crearExpedienteSchema = z.object({
  proyecto_id: z.coerce.number().int().positive(),
  producto_nombre: z.string().min(1),
  modelo: z.string().optional(),
  numero_serie: z.string().optional(),
  responsable_diseno_id: z.coerce.number().int().positive(),
});

const actualizarExpedienteSchema = z.object({
  producto_nombre: z.string().min(1).optional(),
  modelo: z.string().optional(),
  numero_serie: z.string().optional(),
  responsable_diseno_id: z.coerce.number().int().positive().optional(),
});

const cambiarEstadoSchema = z.object({
  estado: z.nativeEnum(ESTADOS),
});

const listarExpedientesQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).optional().default(1),
  tamanoPagina: z.coerce.number().int().min(1).max(100).optional().default(20),
});

module.exports = {
  crearExpedienteSchema,
  actualizarExpedienteSchema,
  cambiarEstadoSchema,
  listarExpedientesQuerySchema,
};
