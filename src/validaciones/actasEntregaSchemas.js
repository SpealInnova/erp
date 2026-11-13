const { z } = require("zod");
const { esquemaListado } = require("./listados");

const itemSchema = z.object({
  descripcion_equipo: z.string().min(1),
  cantidad: z.coerce.number().positive(),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  numero_serie: z.string().optional(),
  cumple: z.enum(["si", "no"]),
});

const crearActaEntregaSchema = z.object({
  proyecto_id: z.coerce.number().int().positive(),
  cliente_id: z.coerce.number().int().positive(),
  numero_contrato_oc: z.string().optional(),
  objeto: z.string().min(1),
  lugar_entrega: z.string().optional(),
  receptor_nombre: z.string().min(1),
  receptor_identificacion: z.string().optional(),
  receptor_cargo: z.string().optional(),
  observaciones: z.string().optional(),
  fecha_elaboracion: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

const actualizarActaEntregaSchema = z.object({
  proyecto_id: z.coerce.number().int().positive().optional(),
  cliente_id: z.coerce.number().int().positive().optional(),
  numero_contrato_oc: z.string().optional(),
  objeto: z.string().min(1).optional(),
  lugar_entrega: z.string().optional(),
  receptor_nombre: z.string().min(1).optional(),
  receptor_identificacion: z.string().optional(),
  receptor_cargo: z.string().optional(),
  observaciones: z.string().optional(),
  fecha_elaboracion: z.string().optional(),
  items: z.array(itemSchema).optional(),
});

const listarActasEntregaQuerySchema = esquemaListado();

module.exports = {
  crearActaEntregaSchema,
  actualizarActaEntregaSchema,
  listarActasEntregaQuerySchema,
};
