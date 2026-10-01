const { z } = require("zod");
const { ESTADOS } = require("../dominio/estadoRequisicion");

const itemSchema = z.object({
  descripcion: z.string().min(1),
  cantidad: z.coerce.number().positive(),
  unidad: z.string().min(1),
});

const crearRequisicionSchema = z.object({
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

const listarRequisicionesQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).optional().default(1),
  tamanoPagina: z.coerce.number().int().min(1).max(100).optional().default(20),
});

module.exports = {
  crearRequisicionSchema,
  actualizarRequisicionSchema,
  cambiarEstadoSchema,
  listarRequisicionesQuerySchema,
};
