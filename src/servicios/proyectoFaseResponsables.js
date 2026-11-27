const repo = require("../repositorios/proyectoFaseResponsablesRepositorio");
const proyectosRepositorio = require("../repositorios/proyectosRepositorio");
const usuariosRepositorio = require("../repositorios/usuariosRepositorio");
const auditoria = require("./auditoria");
const notificacionesServicio = require("./notificaciones");
const { TEXTO_ESTADO } = require("../dominio/estadoProyecto");
const { ErrorProyectoNoEncontrado } = require("../dominio/erroresProyectos");
const {
  ErrorResponsableYaAsignado,
  ErrorResponsableEtapaNoEncontrado,
  ErrorResponsableEtapaInvalido,
} = require("../dominio/erroresFaseResponsables");

// Responsables de cada etapa (fase) de un proyecto, varios por etapa. Los
// asigna cualquiera que pueda editar el proyecto (hoy, todo usuario con
// sesión; decisión del responsable, 2026-11-27). Reciben los avisos de las
// actividades sin responsable de su etapa (avisosActividades), ven el
// proyecto en su inicio (tableroGeneral) y el aviso cuando el proyecto entra
// a su etapa.

const TABLA = "proyecto_fase_responsables";

async function obtenerProyectoExistente(pool, proyectoId) {
  const proyecto = await proyectosRepositorio.obtenerPorId(pool, proyectoId);
  if (!proyecto) {
    throw new ErrorProyectoNoEncontrado();
  }
  return proyecto;
}

async function listarResponsables(pool, proyectoId) {
  await obtenerProyectoExistente(pool, proyectoId);
  return repo.listarPorProyecto(pool, proyectoId);
}

async function asignarResponsable(pool, proyectoId, { fase, usuario_id: personaId }, usuarioId) {
  const proyecto = await obtenerProyectoExistente(pool, proyectoId);
  const persona = await usuariosRepositorio.buscarPorId(pool, personaId);
  if (!persona || !persona.activo) {
    throw new ErrorResponsableEtapaInvalido();
  }

  const clave = { proyectoId, fase, usuarioId: personaId };
  const existente = await repo.obtenerPorClave(pool, clave);
  let id;
  if (existente && existente.deleted_at === null) {
    throw new ErrorResponsableYaAsignado();
  } else if (existente) {
    await repo.reactivar(pool, existente.id, { createdBy: usuarioId });
    id = existente.id;
  } else {
    id = await repo.crear(pool, { ...clave, createdBy: usuarioId });
  }
  const responsable = await repo.obtenerPorId(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "crear",
    usuarioId,
    datosAnteriores: null,
    datosNuevos: responsable,
  });

  if (personaId !== usuarioId) {
    await notificacionesServicio.notificar(pool, {
      usuarioId: personaId,
      tipo: "responsable_etapa",
      mensaje: `Te asignaron como responsable de la etapa "${TEXTO_ESTADO[fase]}" del proyecto ${proyecto.codigo_pry}.`,
      enlace: `#/proyectos/${proyectoId}`,
    });
  }

  return { ...responsable, usuario_nombre: persona.nombre, usuario_cargo: persona.cargo };
}

async function quitarResponsable(pool, proyectoId, id, usuarioId) {
  await obtenerProyectoExistente(pool, proyectoId);
  const responsable = await repo.obtenerPorId(pool, id);
  if (!responsable || responsable.proyecto_id !== proyectoId) {
    throw new ErrorResponsableEtapaNoEncontrado();
  }

  await repo.softDelete(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "eliminar",
    usuarioId,
    datosAnteriores: responsable,
    datosNuevos: null,
  });
}

// Cuando el proyecto entra a una etapa, avisa (campana y correo) a sus
// responsables; `excepto`: a quienes ya les llegó el aviso del cambio de fase.
async function avisarEntradaAEtapa(pool, proyecto, fase, { excepto = [] } = {}) {
  const personas = await repo.listarUsuariosDeFase(pool, proyecto.id, fase);
  for (const personaId of personas.filter((p) => !excepto.includes(p))) {
    await notificacionesServicio.notificar(pool, {
      usuarioId: personaId,
      tipo: "proyecto_cambio_fase",
      mensaje: `El proyecto ${proyecto.codigo_pry} entró a la etapa "${TEXTO_ESTADO[fase]}", de la que eres responsable.`,
      enlace: `#/proyectos/${proyecto.id}`,
      enviarCorreo: true,
    });
  }
}

module.exports = {
  listarResponsables,
  asignarResponsable,
  quitarResponsable,
  avisarEntradaAEtapa,
};
