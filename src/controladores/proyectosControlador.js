const proyectosServicio = require("../servicios/proyectos");
const {
  crearProyectoSchema,
  actualizarProyectoSchema,
  cambiarEstadoSchema,
  listarProyectosQuerySchema,
} = require("../validaciones/proyectosSchemas");

function crearProyectosControlador(pool) {
  async function crear(req, res) {
    const datos = crearProyectoSchema.parse(req.body);
    const proyecto = await proyectosServicio.crearProyecto(pool, datos, req.usuario.id);
    res.status(201).json({ proyecto });
  }

  async function listar(req, res) {
    const query = listarProyectosQuerySchema.parse(req.query);
    const proyectos = await proyectosServicio.listarProyectos(pool, query);
    res.status(200).json({ proyectos });
  }

  async function obtener(req, res) {
    const id = Number(req.params.id);
    const proyecto = await proyectosServicio.obtenerProyecto(pool, id);
    res.status(200).json({ proyecto });
  }

  async function actualizar(req, res) {
    const id = Number(req.params.id);
    const datos = actualizarProyectoSchema.parse(req.body);
    const proyecto = await proyectosServicio.actualizarProyecto(pool, id, datos, req.usuario.id);
    res.status(200).json({ proyecto });
  }

  async function cambiarEstado(req, res) {
    const id = Number(req.params.id);
    const { estado } = cambiarEstadoSchema.parse(req.body);
    const proyecto = await proyectosServicio.cambiarEstadoProyecto(
      pool,
      id,
      estado,
      req.usuario.id
    );
    res.status(200).json({ proyecto });
  }

  async function eliminar(req, res) {
    const id = Number(req.params.id);
    await proyectosServicio.eliminarProyecto(pool, id, req.usuario.id);
    res.status(204).send();
  }

  return { crear, listar, obtener, actualizar, cambiarEstado, eliminar };
}

module.exports = { crearProyectosControlador };
