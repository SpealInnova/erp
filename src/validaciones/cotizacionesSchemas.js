const { z } = require("zod");
const { ESTADOS } = require("../dominio/estadoCotizacion");

const itemSchema = z.object({
  descripcion: z.string().min(1),
  cantidad: z.coerce.number().positive(),
  valor_unitario: z.coerce.number().nonnegative(),
  descuento_porcentaje: z.coerce.number().min(0).max(100).optional().default(0),
  iva_porcentaje: z.coerce.number().min(0).max(100).optional().default(19),
});

const crearCotizacionSchema = z.object({
  cliente_id: z.coerce.number().int().positive(),
  asesor_comercial_id: z.coerce.number().int().positive(),
  fecha_validez: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

const actualizarCotizacionSchema = z.object({
  asesor_comercial_id: z.coerce.number().int().positive().optional(),
  fecha_validez: z.string().optional(),
  items: z.array(itemSchema).optional(),
});

const cambiarEstadoSchema = z.object({
  estado: z.nativeEnum(ESTADOS),
});

const listarCotizacionesQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).optional().default(1),
  tamanoPagina: z.coerce.number().int().min(1).max(100).optional().default(20),
});

module.exports = {
  crearCotizacionSchema,
  actualizarCotizacionSchema,
  cambiarEstadoSchema,
  listarCotizacionesQuerySchema,
};
