const proyectoEquipoServicio = require("../servicios/proyectoEquipo");
const { agregarMiembroSchema } = require("../validaciones/proyectoEquipoSchemas");

function crearProyectoEquipoControlador(pool) {
  async function crear(req, res) {
    const proyectoId = Number(req.params.proyectoId);
    const datos = agregarMiembroSchema.parse(req.body);
    const miembro = await proyectoEquipoServicio.agregarMiembro(
      pool,
      proyectoId,
      datos,
      req.usuario.id
    );
    res.status(201).json({ miembro });
  }

  async function listar(req, res) {
    const proyectoId = Number(req.params.proyectoId);
    const equipo = await proyectoEquipoServicio.listarEquipo(pool, proyectoId);
    res.status(200).json({ equipo });
  }

  async function eliminar(req, res) {
    const proyectoId = Number(req.params.proyectoId);
    const id = Number(req.params.id);
    await proyectoEquipoServicio.quitarMiembro(pool, proyectoId, id, req.usuario.id);
    res.status(204).send();
  }

  return { crear, listar, eliminar };
}

module.exports = { crearProyectoEquipoControlador };
