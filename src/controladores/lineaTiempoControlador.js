const lineaTiempoServicio = require("../servicios/lineaTiempo");

function crearLineaTiempoControlador(pool) {
  async function listar(req, res) {
    const proyectoId = Number(req.params.proyectoId);
    const eventos = await lineaTiempoServicio.obtenerLineaTiempoProyecto(pool, proyectoId);
    res.status(200).json({ eventos });
  }

  return { listar };
}

module.exports = { crearLineaTiempoControlador };
