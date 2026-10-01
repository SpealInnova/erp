const { z } = require("zod");

const loginSchema = z.object({
  correo: z.string().email(),
  password: z.string().min(1),
});

const solicitarRecuperacionSchema = z.object({
  correo: z.string().email(),
});

const restablecerPasswordSchema = z.object({
  token: z.string().min(1),
  nuevaPassword: z.string().min(8),
});

module.exports = { loginSchema, solicitarRecuperacionSchema, restablecerPasswordSchema };
