const bcrypt = require("bcryptjs");
const usuariosRepositorio = require("../repositorios/usuariosRepositorio");
const auditoria = require("./auditoria");
const { ErrorCorreoDuplicado, ErrorCedulaDuplicada } = require("../dominio/erroresUsuarios");

const TABLA = "usuarios";

async function listarUsuarios(pool) {
  return usuariosRepositorio.listarActivos(pool);
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
  const usuarioSinPassword = {
    id: usuario.id,
    nombre: usuario.nombre,
    correo: usuario.correo,
    cedula: usuario.cedula,
    rol: usuario.rol,
    cargo: usuario.cargo,
    activo: usuario.activo,
  };

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

module.exports = { listarUsuarios, crearUsuario };
