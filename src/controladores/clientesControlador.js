const clientesServicio = require("../servicios/clientes");
const {
  crearClienteSchema,
  actualizarClienteSchema,
  listarClientesQuerySchema,
} = require("../validaciones/clientesSchemas");

function crearClientesControlador(pool) {
  async function crear(req, res) {
    const datos = crearClienteSchema.parse(req.body);
    const cliente = await clientesServicio.crearCliente(pool, datos, req.usuario.id);
    res.status(201).json({ cliente });
  }

  async function listar(req, res) {
    const query = listarClientesQuerySchema.parse(req.query);
    const clientes = await clientesServicio.listarClientes(pool, query);
    res.status(200).json({ clientes });
  }

  async function obtener(req, res) {
    const id = Number(req.params.id);
    const cliente = await clientesServicio.obtenerCliente(pool, id);
    res.status(200).json({ cliente });
  }

  async function actualizar(req, res) {
    const id = Number(req.params.id);
    const datos = actualizarClienteSchema.parse(req.body);
    const cliente = await clientesServicio.actualizarCliente(pool, id, datos, req.usuario.id);
    res.status(200).json({ cliente });
  }

  async function eliminar(req, res) {
    const id = Number(req.params.id);
    await clientesServicio.eliminarCliente(pool, id, req.usuario.id);
    res.status(204).send();
  }

  return { crear, listar, obtener, actualizar, eliminar };
}

module.exports = { crearClientesControlador };
