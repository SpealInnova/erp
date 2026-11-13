const autenticacion = require("../servicios/autenticacion");
const recuperacionPassword = require("../servicios/recuperacionPassword");
const usuariosRepositorio = require("../repositorios/usuariosRepositorio");
const { permisosDe, esSuperusuario } = require("../dominio/permisos");
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

  // Además de los datos del token, devuelve nombre, cargo y permisos leídos de
  // la base: el frontend los usa para mostrar u ocultar acciones (el servidor
  // vuelve a validar cada una).
  async function perfil(req, res) {
    const usuario = await usuariosRepositorio.buscarPorId(pool, req.usuario.id);
    res.status(200).json({
      usuario: {
        ...req.usuario,
        nombre: usuario ? usuario.nombre : null,
        cargo: usuario ? usuario.cargo : null,
        permisos: permisosDe(usuario),
        // exento de la regla "quien crea no aprueba" (admin o Gerente General)
        superusuario: Boolean(usuario && usuario.activo) && esSuperusuario(usuario),
      },
    });
  }

  return { login, solicitarRecuperacion, restablecerPassword, perfil };
}

module.exports = { crearAuthControlador };
