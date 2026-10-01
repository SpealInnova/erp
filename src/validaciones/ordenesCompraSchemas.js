const { z } = require("zod");
const { ESTADOS } = require("../dominio/estadoOrdenCompra");

const itemSchema = z.object({
  descripcion: z.string().min(1),
  cantidad: z.coerce.number().positive(),
  precio_unitario: z.coerce.number().nonnegative(),
});

const crearOrdenCompraSchema = z.object({
  requisicion_id: z.coerce.number().int().positive(),
  proveedor_id: z.coerce.number().int().positive(),
  items: z.array(itemSchema).min(1),
});

const actualizarOrdenCompraSchema = z.object({
  proveedor_id: z.coerce.number().int().positive().optional(),
  items: z.array(itemSchema).optional(),
});

const cambiarEstadoSchema = z.object({
  estado: z.nativeEnum(ESTADOS),
});

const listarOrdenesCompraQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).optional().default(1),
  tamanoPagina: z.coerce.number().int().min(1).max(100).optional().default(20),
});

module.exports = {
  crearOrdenCompraSchema,
  actualizarOrdenCompraSchema,
  cambiarEstadoSchema,
  listarOrdenesCompraQuerySchema,
};
