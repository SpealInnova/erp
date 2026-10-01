const { z } = require("zod");

const crearProveedorSchema = z.object({
  nit_cc: z.string().min(1),
  razon_social: z.string().min(1),
  tipo_persona: z.enum(["natural", "juridica"]),
  origen: z.enum(["nacional", "extranjera"]),
  clasificacion: z.enum(["productos", "servicios", "ambos"]),
  contacto_comercial_nombre: z.string().optional(),
  contacto_comercial_telefono: z.string().optional(),
  contacto_comercial_email: z.string().email().optional(),
  contacto_pagos_nombre: z.string().optional(),
  contacto_pagos_telefono: z.string().optional(),
  contacto_pagos_email: z.string().email().optional(),
  contacto_tecnico_nombre: z.string().optional(),
  contacto_tecnico_telefono: z.string().optional(),
  contacto_tecnico_email: z.string().email().optional(),
  documentacion_estado: z.record(z.string()).optional(),
});

const actualizarProveedorSchema = crearProveedorSchema.partial();

const listarProveedoresQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).optional().default(1),
  tamanoPagina: z.coerce.number().int().min(1).max(100).optional().default(20),
});

module.exports = { crearProveedorSchema, actualizarProveedorSchema, listarProveedoresQuerySchema };
