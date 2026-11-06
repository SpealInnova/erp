const notificacionesServicio = require("../servicios/notificaciones");

function crearNotificacionesControlador(pool) {
  async function listar(req, res) {
    const resultado = await notificacionesServicio.listarNotificaciones(pool, req.usuario.id);
    res.status(200).json(resultado);
  }

  async function marcarLeida(req, res) {
    const id = Number(req.params.id);
    await notificacionesServicio.marcarLeida(pool, id, req.usuario.id);
    res.status(204).end();
  }

  async function marcarTodasLeidas(req, res) {
    await notificacionesServicio.marcarTodasLeidas(pool, req.usuario.id);
    res.status(204).end();
  }

  return { listar, marcarLeida, marcarTodasLeidas };
}

module.exports = { crearNotificacionesControlador };
