const clientesRepositorio = require("../repositorios/clientesRepositorio");
const auditoria = require("./auditoria");
const { ErrorClienteNoEncontrado, ErrorIdentificacionDuplicada } = require("../dominio/erroresClientes");

const TABLA = "clientes";

async function crearCliente(pool, datos, usuarioId) {
  const existente = await clientesRepositorio.buscarPorNumeroIdentificacion(
    pool,
    datos.numero_identificacion
  );
  if (existente) {
    throw new ErrorIdentificacionDuplicada();
  }

  const id = await clientesRepositorio.crear(pool, { ...datos, created_by: usuarioId });
  const cliente = await clientesRepositorio.obtenerPorId(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "crear",
    usuarioId,
    datosAnteriores: null,
    datosNuevos: cliente,
  });

  return cliente;
}

async function obtenerCliente(pool, id) {
  const cliente = await clientesRepositorio.obtenerPorId(pool, id);
  if (!cliente) {
    throw new ErrorClienteNoEncontrado();
  }
  return cliente;
}

async function listarClientes(pool, { pagina, tamanoPagina }) {
  const limite = tamanoPagina;
  const offset = (pagina - 1) * tamanoPagina;
  return clientesRepositorio.listar(pool, { limite, offset });
}

async function actualizarCliente(pool, id, datos, usuarioId) {
  const clienteAnterior = await obtenerCliente(pool, id);

  if (datos.numero_identificacion) {
    const existente = await clientesRepositorio.buscarPorNumeroIdentificacion(
      pool,
      datos.numero_identificacion,
      id
    );
    if (existente) {
      throw new ErrorIdentificacionDuplicada();
    }
  }

  await clientesRepositorio.actualizar(pool, id, datos);
  const clienteActualizado = await clientesRepositorio.obtenerPorId(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "actualizar",
    usuarioId,
    datosAnteriores: clienteAnterior,
    datosNuevos: clienteActualizado,
  });

  return clienteActualizado;
}

async function eliminarCliente(pool, id, usuarioId) {
  const clienteAnterior = await obtenerCliente(pool, id);
  await clientesRepositorio.softDelete(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "eliminar",
    usuarioId,
    datosAnteriores: clienteAnterior,
    datosNuevos: null,
  });
}

module.exports = { crearCliente, obtenerCliente, listarClientes, actualizarCliente, eliminarCliente };
