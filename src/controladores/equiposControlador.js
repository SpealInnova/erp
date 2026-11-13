const equiposServicio = require("../servicios/equipos");
const {
  crearEquipoSchema,
  actualizarEquipoSchema,
  listarEquiposQuerySchema,
} = require("../validaciones/equiposSchemas");

function crearEquiposControlador(pool) {
  async function listar(req, res) {
    const query = listarEquiposQuerySchema.parse(req.query);
    const equipos = await equiposServicio.listarEquipos(pool, {
      clienteId: query.cliente_id,
      proyectoId: query.proyecto_id,
      numeroSerie: query.numero_serie,
    });
    res.status(200).json({ equipos });
  }

  async function obtener(req, res) {
    const equipo = await equiposServicio.obtenerEquipo(pool, Number(req.params.id));
    res.status(200).json({ equipo });
  }

  async function crear(req, res) {
    const datos = crearEquipoSchema.parse(req.body);
    const equipo = await equiposServicio.crearEquipoHistorico(pool, datos, req.usuario.id);
    res.status(201).json({ equipo });
  }

  async function actualizar(req, res) {
    const datos = actualizarEquipoSchema.parse(req.body);
    const equipo = await equiposServicio.actualizarEquipoHistorico(
      pool,
      Number(req.params.id),
      datos,
      req.usuario.id
    );
    res.status(200).json({ equipo });
  }

  return { listar, obtener, crear, actualizar };
}

module.exports = { crearEquiposControlador };
