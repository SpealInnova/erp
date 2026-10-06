const { z } = require("zod");

const itemSchema = z.object({
  elemento: z.string().min(1),
  cantidad: z.coerce.number().positive(),
  cumple: z.enum(["si", "no"]),
});

const crearActaSchema = z.object({
  proyecto_id: z.coerce.number().int().positive(),
  cliente_id: z.coerce.number().int().positive(),
  tipo_entrega: z.enum(["venta", "demostracion", "piloto"]),
  tipo_documento_referencia: z.enum([
    "orden_compra",
    "contrato",
    "consorcio",
    "union_temporal",
    "otro",
  ]),
  numero_documento_referencia: z.string().optional(),
  objeto: z.string().min(1),
  receptor_cliente_nombre: z.string().min(1),
  receptor_cliente_cargo: z.string().optional(),
  fecha_elaboracion: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

const actualizarActaSchema = z.object({
  proyecto_id: z.coerce.number().int().positive().optional(),
  cliente_id: z.coerce.number().int().positive().optional(),
  tipo_entrega: z.enum(["venta", "demostracion", "piloto"]).optional(),
  tipo_documento_referencia: z
    .enum(["orden_compra", "contrato", "consorcio", "union_temporal", "otro"])
    .optional(),
  numero_documento_referencia: z.string().optional(),
  objeto: z.string().min(1).optional(),
  receptor_cliente_nombre: z.string().min(1).optional(),
  receptor_cliente_cargo: z.string().optional(),
  fecha_elaboracion: z.string().optional(),
  items: z.array(itemSchema).optional(),
});

const listarActasQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).optional().default(1),
  tamanoPagina: z.coerce.number().int().min(1).max(100).optional().default(20),
});

module.exports = { crearActaSchema, actualizarActaSchema, listarActasQuerySchema };
