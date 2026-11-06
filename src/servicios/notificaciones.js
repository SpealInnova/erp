const notificacionesRepositorio = require("../repositorios/notificacionesRepositorio");
const usuariosRepositorio = require("../repositorios/usuariosRepositorio");
const correo = require("./correo");
const { ErrorNotificacionNoEncontrada } = require("../dominio/erroresNotificaciones");

const LIMITE_LISTADO = 50;

// Punto central de notificación: lo usan los demás servicios (proyectos,
// actividades, etc.) cuando ocurre un evento relevante para un usuario.
// Si enviarCorreo es true, además intenta un correo — sin bloquear al
// llamador si el envío falla (p. ej. credenciales de Gmail no configuradas).
async function notificar(pool, { usuarioId, tipo, mensaje, enlace, enviarCorreo: debeEnviarCorreo }) {
  if (!usuarioId) return;

  await notificacionesRepositorio.crear(pool, { usuarioId, tipo, mensaje, enlace });

  if (!debeEnviarCorreo) return;
  try {
    const usuario = await usuariosRepositorio.buscarPorId(pool, usuarioId);
    if (!usuario) return;
    await correo.enviarCorreo({
      destinatario: usuario.correo,
      asunto: "SPEAL Project Control — Nueva notificación",
      textoPlano: `Hola ${usuario.nombre},\n\n${mensaje}${enlace ? `\n\n${process.env.APP_URL || ""}${enlace}` : ""}`,
    });
  } catch (error) {
    console.error("No se pudo enviar el correo de notificación:", error.message);
  }
}

async function listarNotificaciones(pool, usuarioId) {
  const [notificaciones, noLeidas] = await Promise.all([
    notificacionesRepositorio.listarPorUsuario(pool, usuarioId, LIMITE_LISTADO),
    notificacionesRepositorio.contarNoLeidas(pool, usuarioId),
  ]);
  return { notificaciones, no_leidas: noLeidas };
}

async function marcarLeida(pool, id, usuarioId) {
  const notificacion = await notificacionesRepositorio.obtenerPorId(pool, id);
  if (!notificacion || notificacion.usuario_id !== usuarioId) {
    throw new ErrorNotificacionNoEncontrada();
  }
  await notificacionesRepositorio.marcarLeida(pool, id);
}

async function marcarTodasLeidas(pool, usuarioId) {
  await notificacionesRepositorio.marcarTodasLeidas(pool, usuarioId);
}

module.exports = { notificar, listarNotificaciones, marcarLeida, marcarTodasLeidas };
