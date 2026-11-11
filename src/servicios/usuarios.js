const bcrypt = require("bcryptjs");
const usuariosRepositorio = require("../repositorios/usuariosRepositorio");
const auditoria = require("./auditoria");
const {
  ErrorCorreoDuplicado,
  ErrorCedulaDuplicada,
  ErrorUsuarioNoEncontrado,
} = require("../dominio/erroresUsuarios");

const TABLA = "usuarios";

function quitarPassword(usuario) {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    correo: usuario.correo,
    cedula: usuario.cedula,
    rol: usuario.rol,
    cargo: usuario.cargo,
    activo: usuario.activo,
  };
}

async function listarUsuarios(pool) {
  return usuariosRepositorio.listarActivos(pool);
}

async function actualizarUsuario(pool, id, datos, usuarioId) {
  const anterior = await usuariosRepositorio.buscarPorId(pool, id);
  if (!anterior) {
    throw new ErrorUsuarioNoEncontrado();
  }

  if (datos.correo && datos.correo !== anterior.correo) {
    const correoExistente = await usuariosRepositorio.buscarPorCorreo(pool, datos.correo);
    if (correoExistente) {
      throw new ErrorCorreoDuplicado();
    }
  }
  if (datos.cedula && datos.cedula !== anterior.cedula) {
    const cedulaExistente = await usuariosRepositorio.buscarPorCedula(pool, datos.cedula);
    if (cedulaExistente) {
      throw new ErrorCedulaDuplicada();
    }
  }

  await usuariosRepositorio.actualizar(pool, id, datos);
  const actualizado = await usuariosRepositorio.buscarPorId(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "actualizar",
    usuarioId,
    datosAnteriores: quitarPassword(anterior),
    datosNuevos: quitarPassword(actualizado),
  });

  return quitarPassword(actualizado);
}

async function crearUsuario(pool, datos, usuarioId) {
  const correoExistente = await usuariosRepositorio.buscarPorCorreo(pool, datos.correo);
  if (correoExistente) {
    throw new ErrorCorreoDuplicado();
  }
  const cedulaExistente = await usuariosRepositorio.buscarPorCedula(pool, datos.cedula);
  if (cedulaExistente) {
    throw new ErrorCedulaDuplicada();
  }

  const passwordHash = await bcrypt.hash(datos.password, 10);
  const id = await usuariosRepositorio.crear(pool, {
    nombre: datos.nombre,
    correo: datos.correo,
    cedula: datos.cedula,
    password_hash: passwordHash,
    rol: datos.rol,
    cargo: datos.cargo,
  });
  const usuario = await usuariosRepositorio.buscarPorId(pool, id);
  const usuarioSinPassword = quitarPassword(usuario);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "crear",
    usuarioId,
    datosAnteriores: null,
    datosNuevos: usuarioSinPassword,
  });

  return usuarioSinPassword;
}

module.exports = { listarUsuarios, crearUsuario, actualizarUsuario };
