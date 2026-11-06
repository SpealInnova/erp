const lineaTiempoRepositorio = require("../repositorios/lineaTiempoRepositorio");
const proyectosRepositorio = require("../repositorios/proyectosRepositorio");
const { ErrorProyectoNoEncontrado } = require("../dominio/erroresProyectos");

// El backend solo extrae los datos del evento (qué cambió, quién, cuándo); la
// traducción a texto legible (p. ej. nombre de la fase) queda del lado del
// frontend, igual que el resto de catálogos de la aplicación.
function normalizarEvento(fila, nombresPorUsuario) {
  const anterior = fila.datos_anteriores;
  const nuevo = fila.datos_nuevos;

  const base = {
    id: fila.id,
    tabla: fila.tabla,
    accion: fila.accion,
    usuario_id: fila.usuario_id,
    usuario_nombre: fila.usuario_id ? nombresPorUsuario.get(fila.usuario_id) || null : null,
    creado_en: fila.creado_en,
  };

  if (fila.tabla === "proyectos") {
    const cambioEstado =
      anterior && nuevo && anterior.estado !== nuevo.estado
        ? { de: anterior.estado, a: nuevo.estado }
        : null;
    return {
      ...base,
      codigo_pry: nuevo?.codigo_pry || anterior?.codigo_pry || null,
      cambio_estado: cambioEstado,
      observacion: nuevo?.observacion || null,
    };
  }

  if (fila.tabla === "proyecto_actividades") {
    const cambioEstado =
      anterior && nuevo && anterior.estado !== nuevo.estado
        ? { de: anterior.estado, a: nuevo.estado }
        : null;
    return {
      ...base,
      actividad_descripcion: nuevo?.descripcion || anterior?.descripcion || null,
      actividad_fase: nuevo?.fase || anterior?.fase || null,
      actividad_cambio_estado: cambioEstado,
    };
  }

  return base;
}

async function obtenerLineaTiempoProyecto(pool, proyectoId) {
  const proyecto = await proyectosRepositorio.obtenerPorId(pool, proyectoId);
  if (!proyecto) {
    throw new ErrorProyectoNoEncontrado();
  }

  const eventos = await lineaTiempoRepositorio.listarEventosProyecto(pool, proyectoId);
  const idsUsuarios = [...new Set(eventos.map((e) => e.usuario_id).filter(Boolean))];
  const usuarios = await lineaTiempoRepositorio.listarUsuariosPorIds(pool, idsUsuarios);
  const nombresPorUsuario = new Map(usuarios.map((u) => [u.id, u.nombre]));

  return eventos.map((fila) => normalizarEvento(fila, nombresPorUsuario));
}

module.exports = { obtenerLineaTiempoProyecto };
