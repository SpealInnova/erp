const ordenesCompraServicio = require("../servicios/ordenesCompra");
const {
  crearOrdenCompraSchema,
  actualizarOrdenCompraSchema,
  cambiarEstadoSchema,
  listarOrdenesCompraQuerySchema,
} = require("../validaciones/ordenesCompraSchemas");

function crearOrdenesCompraControlador(pool) {
  async function crear(req, res) {
    const datos = crearOrdenCompraSchema.parse(req.body);
    const orden = await ordenesCompraServicio.crearOrdenCompra(pool, datos, req.usuario.id);
    res.status(201).json({ orden });
  }

  async function listar(req, res) {
    const query = listarOrdenesCompraQuerySchema.parse(req.query);
    const ordenes = await ordenesCompraServicio.listarOrdenesCompra(pool, query);
    res.status(200).json({ ordenes });
  }

  async function obtener(req, res) {
    const id = Number(req.params.id);
    const orden = await ordenesCompraServicio.obtenerConItems(pool, id);
    res.status(200).json({ orden });
  }

  async function actualizar(req, res) {
    const id = Number(req.params.id);
    const datos = actualizarOrdenCompraSchema.parse(req.body);
    const orden = await ordenesCompraServicio.actualizarOrdenCompra(
      pool,
      id,
      datos,
      req.usuario.id
    );
    res.status(200).json({ orden });
  }

  async function cambiarEstado(req, res) {
    const id = Number(req.params.id);
    const { estado } = cambiarEstadoSchema.parse(req.body);
    const orden = await ordenesCompraServicio.cambiarEstadoOrdenCompra(
      pool,
      id,
      estado,
      req.usuario.id
    );
    res.status(200).json({ orden });
  }

  async function eliminar(req, res) {
    const id = Number(req.params.id);
    await ordenesCompraServicio.eliminarOrdenCompra(pool, id, req.usuario.id);
    res.status(204).send();
  }

  return { crear, listar, obtener, actualizar, cambiarEstado, eliminar };
}

module.exports = { crearOrdenesCompraControlador };
