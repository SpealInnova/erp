const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const usuariosRepositorio = require("../repositorios/usuariosRepositorio");
const correo = require("./correo");
const { ErrorTokenInvalido } = require("../dominio/erroresAuth");

const EXPIRACION_TOKEN_MIN = 30;

async function solicitarRecuperacion(pool, correoDestino) {
  const usuario = await usuariosRepositorio.buscarPorCorreo(pool, correoDestino);
  if (!usuario) {
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expira = new Date(Date.now() + EXPIRACION_TOKEN_MIN * 60000);
  await usuariosRepositorio.guardarTokenRecuperacion(pool, usuario.id, token, expira);

  const enlace = `${process.env.APP_URL}/restablecer-password?token=${token}`;
  await correo.enviarCorreo({
    destinatario: usuario.correo,
    asunto: "Recuperación de contraseña — SPEAL Project Control",
    textoPlano: `Hola ${usuario.nombre},\n\nSolicitaste restablecer tu contraseña. Este enlace vence en ${EXPIRACION_TOKEN_MIN} minutos:\n${enlace}\n\nSi no fuiste tú, ignora este correo.`,
  });
}

async function restablecerPassword(pool, { token, nuevaPassword }) {
  const usuario = await usuariosRepositorio.buscarPorTokenRecuperacion(pool, token);
  if (!usuario || !usuario.token_recuperacion_expira) {
    throw new ErrorTokenInvalido();
  }
  if (new Date(usuario.token_recuperacion_expira) < new Date()) {
    throw new ErrorTokenInvalido();
  }

  const passwordHash = await bcrypt.hash(nuevaPassword, 10);
  await usuariosRepositorio.actualizarPassword(pool, usuario.id, passwordHash);
}

module.exports = { solicitarRecuperacion, restablecerPassword };
