const salidasDisenoServicio = require("../servicios/salidasDiseno");
const {
  crearSalidaSchema,
  actualizarSalidaSchema,
} = require("../validaciones/salidasDisenoSchemas");

function crearSalidasDisenoControlador(pool) {
  async function crear(req, res) {
    const expedienteId = Number(req.params.expedienteId);
    const datos = crearSalidaSchema.parse(req.body);
    const salida = await salidasDisenoServicio.crearSalida(pool, expedienteId, datos, req.usuario.id);
    res.status(201).json({ salida });
  }

  async function listar(req, res) {
    const expedienteId = Number(req.params.expedienteId);
    const salidas = await salidasDisenoServicio.listarSalidas(pool, expedienteId);
    res.status(200).json({ salidas });
  }

  async function obtener(req, res) {
    const id = Number(req.params.id);
    const salida = await salidasDisenoServicio.obtenerSalida(pool, id);
    res.status(200).json({ salida });
  }

  async function actualizar(req, res) {
    const id = Number(req.params.id);
    const datos = actualizarSalidaSchema.parse(req.body);
    const salida = await salidasDisenoServicio.actualizarSalida(pool, id, datos, req.usuario.id);
    res.status(200).json({ salida });
  }

  async function eliminar(req, res) {
    const id = Number(req.params.id);
    await salidasDisenoServicio.eliminarSalida(pool, id, req.usuario.id);
    res.status(204).send();
  }

  return { crear, listar, obtener, actualizar, eliminar };
}

module.exports = { crearSalidasDisenoControlador };
