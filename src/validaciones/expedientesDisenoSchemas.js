const { z } = require("zod");
const { esquemaListado, filtroEstado } = require("./listados");
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

const listarExpedientesQuerySchema = esquemaListado(filtroEstado(ESTADOS));

module.exports = {
  crearExpedienteSchema,
  actualizarExpedienteSchema,
  cambiarEstadoSchema,
  listarExpedientesQuerySchema,
};
