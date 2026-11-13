const { z } = require("zod");
const { esquemaListado, filtroEstado } = require("./listados");
const { ESTADOS } = require("../dominio/estadoRequisicion");

const itemSchema = z.object({
  descripcion: z.string().min(1),
  cantidad: z.coerce.number().int().positive(),
  unidad: z.string().min(1),
});

const crearRequisicionSchema = z.object({
  numero_requisicion: z.string().min(1),
  proyecto_id: z.coerce.number().int().positive(),
  procedencia: z.enum(["nacional", "importacion", "almacen"]),
  items: z.array(itemSchema).min(1),
});

const actualizarRequisicionSchema = z.object({
  procedencia: z.enum(["nacional", "importacion", "almacen"]).optional(),
  items: z.array(itemSchema).optional(),
});

const cambiarEstadoSchema = z.object({
  estado: z.nativeEnum(ESTADOS),
});

const listarRequisicionesQuerySchema = esquemaListado(filtroEstado(ESTADOS));

module.exports = {
  crearRequisicionSchema,
  actualizarRequisicionSchema,
  cambiarEstadoSchema,
  listarRequisicionesQuerySchema,
};
