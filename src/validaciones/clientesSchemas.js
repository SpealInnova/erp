const { z } = require("zod");

const crearClienteSchema = z.object({
  nombre_razon_social: z.string().min(1),
  tipo_identificacion: z.enum(["CC", "NIT", "CE", "Pasaporte"]),
  numero_identificacion: z.string().min(1),
  pais: z.string().optional(),
  ciudad: z.string().optional(),
  direccion: z.string().optional(),
  contacto_nombre: z.string().optional(),
  contacto_telefono: z.string().optional(),
  contacto_email: z.string().email().optional(),
});

const actualizarClienteSchema = crearClienteSchema.partial();

const listarClientesQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).optional().default(1),
  tamanoPagina: z.coerce.number().int().min(1).max(100).optional().default(20),
});

module.exports = { crearClienteSchema, actualizarClienteSchema, listarClientesQuerySchema };
