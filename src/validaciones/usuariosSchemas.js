const { z } = require("zod");
const { CARGOS } = require("../dominio/catalogoCargos");

const crearUsuarioSchema = z.object({
  nombre: z.string().min(1),
  correo: z.string().email(),
  cedula: z.string().min(1),
  password: z.string().min(8),
  rol: z.string().min(1),
  cargo: z.enum(CARGOS),
});

const actualizarUsuarioSchema = z.object({
  nombre: z.string().min(1).optional(),
  correo: z.string().email().optional(),
  cedula: z.string().min(1).optional(),
  rol: z.string().min(1).optional(),
  cargo: z.enum(CARGOS).optional(),
});

module.exports = { crearUsuarioSchema, actualizarUsuarioSchema };
