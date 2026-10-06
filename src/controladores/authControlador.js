const autenticacion = require("../servicios/autenticacion");
const recuperacionPassword = require("../servicios/recuperacionPassword");
const {
  loginSchema,
  solicitarRecuperacionSchema,
  restablecerPasswordSchema,
} = require("../validaciones/authSchemas");

function crearAuthControlador(pool) {
  async function login(req, res) {
    const datos = loginSchema.parse(req.body);
    const resultado = await autenticacion.iniciarSesion(pool, datos);
    res.status(200).json(resultado);
  }

  async function solicitarRecuperacion(req, res) {
    const datos = solicitarRecuperacionSchema.parse(req.body);
    await recuperacionPassword.solicitarRecuperacion(pool, datos.correo);
    res.status(200).json({ mensaje: "Si el correo existe, se enviaron instrucciones." });
  }

  async function restablecerPassword(req, res) {
    const datos = restablecerPasswordSchema.parse(req.body);
    await recuperacionPassword.restablecerPassword(pool, datos);
    res.status(200).json({ mensaje: "Contraseña actualizada." });
  }

  async function perfil(req, res) {
    res.status(200).json({ usuario: req.usuario });
  }

  return { login, solicitarRecuperacion, restablecerPassword, perfil };
}

module.exports = { crearAuthControlador };
