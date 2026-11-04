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

module.exports = { crearUsuarioSchema };
