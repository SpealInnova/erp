const riesgosDisenoServicio = require("../servicios/riesgosDiseno");
const {
  crearRiesgoSchema,
  actualizarRiesgoSchema,
} = require("../validaciones/riesgosDisenoSchemas");

function crearRiesgosDisenoControlador(pool) {
  async function crear(req, res) {
    const expedienteId = Number(req.params.expedienteId);
    const datos = crearRiesgoSchema.parse(req.body);
    const riesgo = await riesgosDisenoServicio.crearRiesgo(pool, expedienteId, datos, req.usuario.id);
    res.status(201).json({ riesgo });
  }

  async function listar(req, res) {
    const expedienteId = Number(req.params.expedienteId);
    const riesgos = await riesgosDisenoServicio.listarRiesgos(pool, expedienteId);
    res.status(200).json({ riesgos });
  }

  async function obtener(req, res) {
    const id = Number(req.params.id);
    const riesgo = await riesgosDisenoServicio.obtenerRiesgo(pool, id);
    res.status(200).json({ riesgo });
  }

  async function actualizar(req, res) {
    const id = Number(req.params.id);
    const datos = actualizarRiesgoSchema.parse(req.body);
    const riesgo = await riesgosDisenoServicio.actualizarRiesgo(pool, id, datos, req.usuario.id);
    res.status(200).json({ riesgo });
  }

  async function eliminar(req, res) {
    const id = Number(req.params.id);
    await riesgosDisenoServicio.eliminarRiesgo(pool, id, req.usuario.id);
    res.status(204).send();
  }

  return { crear, listar, obtener, actualizar, eliminar };
}

module.exports = { crearRiesgosDisenoControlador };
