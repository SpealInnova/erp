const proyectoEquipoRepositorio = require("../repositorios/proyectoEquipoRepositorio");
const proyectosRepositorio = require("../repositorios/proyectosRepositorio");
const usuariosRepositorio = require("../repositorios/usuariosRepositorio");
const auditoria = require("./auditoria");
const notificacionesServicio = require("./notificaciones");
const { ErrorProyectoNoEncontrado } = require("../dominio/erroresProyectos");
const {
  ErrorMiembroYaEnEquipo,
  ErrorMiembroNoEncontrado,
  ErrorUsuarioInvalido,
} = require("../dominio/erroresProyectoEquipo");

const TABLA = "proyecto_equipo";

async function obtenerProyectoExistente(pool, proyectoId) {
  const proyecto = await proyectosRepositorio.obtenerPorId(pool, proyectoId);
  if (!proyecto) {
    throw new ErrorProyectoNoEncontrado();
  }
  return proyecto;
}

async function listarEquipo(pool, proyectoId) {
  await obtenerProyectoExistente(pool, proyectoId);
  return proyectoEquipoRepositorio.listarPorProyecto(pool, proyectoId);
}

async function agregarMiembro(pool, proyectoId, datos, usuarioId) {
  const proyecto = await obtenerProyectoExistente(pool, proyectoId);

  const usuario = await usuariosRepositorio.buscarPorId(pool, datos.usuario_id);
  if (!usuario) {
    throw new ErrorUsuarioInvalido();
  }

  const existente = await proyectoEquipoRepositorio.obtenerPorProyectoYUsuario(
    pool,
    proyectoId,
    datos.usuario_id
  );

  let id;
  if (existente && existente.deleted_at === null) {
    throw new ErrorMiembroYaEnEquipo();
  } else if (existente) {
    await proyectoEquipoRepositorio.reactivar(pool, existente.id, {
      rolEnProyecto: datos.rol_en_proyecto,
      createdBy: usuarioId,
    });
    id = existente.id;
  } else {
    id = await proyectoEquipoRepositorio.crear(pool, proyectoId, {
      usuarioId: datos.usuario_id,
      rolEnProyecto: datos.rol_en_proyecto,
      createdBy: usuarioId,
    });
  }

  const miembro = await proyectoEquipoRepositorio.obtenerPorId(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "crear",
    usuarioId,
    datosAnteriores: null,
    datosNuevos: miembro,
  });

  await notificacionesServicio.notificar(pool, {
    usuarioId: datos.usuario_id,
    tipo: "equipo_agregado",
    mensaje: `Te agregaron al equipo del proyecto ${proyecto.codigo_pry} como ${datos.rol_en_proyecto}.`,
    enlace: `#/proyectos/${proyectoId}`,
  });

  return { ...miembro, usuario_nombre: usuario.nombre };
}

async function quitarMiembro(pool, proyectoId, id, usuarioId) {
  await obtenerProyectoExistente(pool, proyectoId);

  const miembro = await proyectoEquipoRepositorio.obtenerPorId(pool, id);
  if (!miembro || miembro.proyecto_id !== proyectoId) {
    throw new ErrorMiembroNoEncontrado();
  }

  await proyectoEquipoRepositorio.softDelete(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "eliminar",
    usuarioId,
    datosAnteriores: miembro,
    datosNuevos: null,
  });
}

module.exports = { listarEquipo, agregarMiembro, quitarMiembro };
