const cambiosDisenoServicio = require("../servicios/cambiosDiseno");
const {
  crearCambioSchema,
  actualizarCambioSchema,
} = require("../validaciones/cambiosDisenoSchemas");

function crearCambiosDisenoControlador(pool) {
  async function crear(req, res) {
    const expedienteId = Number(req.params.expedienteId);
    const datos = crearCambioSchema.parse(req.body);
    const cambio = await cambiosDisenoServicio.crearCambio(pool, expedienteId, datos, req.usuario.id);
    res.status(201).json({ cambio });
  }

  async function listar(req, res) {
    const expedienteId = Number(req.params.expedienteId);
    const cambios = await cambiosDisenoServicio.listarCambios(pool, expedienteId);
    res.status(200).json({ cambios });
  }

  async function obtener(req, res) {
    const id = Number(req.params.id);
    const cambio = await cambiosDisenoServicio.obtenerCambio(pool, id);
    res.status(200).json({ cambio });
  }

  async function actualizar(req, res) {
    const id = Number(req.params.id);
    const datos = actualizarCambioSchema.parse(req.body);
    const cambio = await cambiosDisenoServicio.actualizarCambio(pool, id, datos, req.usuario.id);
    res.status(200).json({ cambio });
  }

  async function eliminar(req, res) {
    const id = Number(req.params.id);
    await cambiosDisenoServicio.eliminarCambio(pool, id, req.usuario.id);
    res.status(204).send();
  }

  return { crear, listar, obtener, actualizar, eliminar };
}

module.exports = { crearCambiosDisenoControlador };
