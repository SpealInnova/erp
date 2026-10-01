const proveedoresServicio = require("../servicios/proveedores");
const {
  crearProveedorSchema,
  actualizarProveedorSchema,
  listarProveedoresQuerySchema,
} = require("../validaciones/proveedoresSchemas");

function crearProveedoresControlador(pool) {
  async function crear(req, res) {
    const datos = crearProveedorSchema.parse(req.body);
    const proveedor = await proveedoresServicio.crearProveedor(pool, datos, req.usuario.id);
    res.status(201).json({ proveedor });
  }

  async function listar(req, res) {
    const query = listarProveedoresQuerySchema.parse(req.query);
    const proveedores = await proveedoresServicio.listarProveedores(pool, query);
    res.status(200).json({ proveedores });
  }

  async function obtener(req, res) {
    const id = Number(req.params.id);
    const proveedor = await proveedoresServicio.obtenerProveedor(pool, id);
    res.status(200).json({ proveedor });
  }

  async function actualizar(req, res) {
    const id = Number(req.params.id);
    const datos = actualizarProveedorSchema.parse(req.body);
    const proveedor = await proveedoresServicio.actualizarProveedor(
      pool,
      id,
      datos,
      req.usuario.id
    );
    res.status(200).json({ proveedor });
  }

  async function eliminar(req, res) {
    const id = Number(req.params.id);
    await proveedoresServicio.eliminarProveedor(pool, id, req.usuario.id);
    res.status(204).send();
  }

  return { crear, listar, obtener, actualizar, eliminar };
}

module.exports = { crearProveedoresControlador };
