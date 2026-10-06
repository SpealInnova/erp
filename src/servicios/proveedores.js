const proveedoresRepositorio = require("../repositorios/proveedoresRepositorio");
const auditoria = require("./auditoria");
const { ErrorProveedorNoEncontrado, ErrorNitDuplicado } = require("../dominio/erroresProveedores");

const TABLA = "proveedores";

async function crearProveedor(pool, datos, usuarioId) {
  const existente = await proveedoresRepositorio.buscarPorNitCc(pool, datos.nit_cc);
  if (existente) {
    throw new ErrorNitDuplicado();
  }

  const id = await proveedoresRepositorio.crear(pool, { ...datos, created_by: usuarioId });
  const proveedor = await proveedoresRepositorio.obtenerPorId(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "crear",
    usuarioId,
    datosAnteriores: null,
    datosNuevos: proveedor,
  });

  return proveedor;
}

async function obtenerProveedor(pool, id) {
  const proveedor = await proveedoresRepositorio.obtenerPorId(pool, id);
  if (!proveedor) {
    throw new ErrorProveedorNoEncontrado();
  }
  return proveedor;
}

async function listarProveedores(pool, { pagina, tamanoPagina }) {
  const limite = tamanoPagina;
  const offset = (pagina - 1) * tamanoPagina;
  return proveedoresRepositorio.listar(pool, { limite, offset });
}

async function actualizarProveedor(pool, id, datos, usuarioId) {
  const anterior = await obtenerProveedor(pool, id);

  if (datos.nit_cc) {
    const existente = await proveedoresRepositorio.buscarPorNitCc(pool, datos.nit_cc, id);
    if (existente) {
      throw new ErrorNitDuplicado();
    }
  }

  await proveedoresRepositorio.actualizar(pool, id, datos);
  const actualizado = await proveedoresRepositorio.obtenerPorId(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "actualizar",
    usuarioId,
    datosAnteriores: anterior,
    datosNuevos: actualizado,
  });

  return actualizado;
}

async function eliminarProveedor(pool, id, usuarioId) {
  const anterior = await obtenerProveedor(pool, id);
  await proveedoresRepositorio.softDelete(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "eliminar",
    usuarioId,
    datosAnteriores: anterior,
    datosNuevos: null,
  });
}

module.exports = {
  crearProveedor,
  obtenerProveedor,
  listarProveedores,
  actualizarProveedor,
  eliminarProveedor,
};
