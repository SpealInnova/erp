const { z } = require("zod");
const { esquemaListado } = require("./listados");

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

const listarClientesQuerySchema = esquemaListado();

module.exports = { crearClienteSchema, actualizarClienteSchema, listarClientesQuerySchema };
