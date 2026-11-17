const lineaTiempoRepositorio = require("../repositorios/lineaTiempoRepositorio");
const proyectosRepositorio = require("../repositorios/proyectosRepositorio");
const { ErrorProyectoNoEncontrado } = require("../dominio/erroresProyectos");

// Documentos de otros módulos que aparecen en la línea de tiempo del proyecto:
// de dónde sale su código y qué campo es su estado (si tiene).
const DOCUMENTOS = {
  expedientes_diseno: { codigo: "codigo_expediente", estado: "estado_liberacion" },
  requisiciones: { codigo: "numero_requisicion", estado: "estado" },
  ordenes_compra: { codigo: "numero_oc", estado: "estado" },
  reportes_servicio_tecnico: { codigo: "numero_reporte", estado: null },
  actas_entrega_equipos: { codigo: "numero_acta", estado: null },
  actas_cierre_satisfaccion: { codigo: "numero_acta", estado: null },
};

// Según el motor, las columnas JSON llegan ya convertidas o como texto.
function comoObjeto(valor) {
  if (typeof valor !== "string") return valor;
  try {
    return JSON.parse(valor);
  } catch {
    return null;
  }
}

// El backend solo extrae los datos del evento (qué cambió, quién, cuándo); la
// traducción a texto legible (p. ej. nombre de la fase) queda del lado del
// frontend, igual que el resto de catálogos de la aplicación.
function normalizarEvento(fila, nombresPorUsuario) {
  const anterior = comoObjeto(fila.datos_anteriores);
  const nuevo = comoObjeto(fila.datos_nuevos);

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

  if (fila.tabla === "proyecto_equipo") {
    const miembroUsuarioId = nuevo?.usuario_id || anterior?.usuario_id || null;
    return {
      ...base,
      miembro_usuario_id: miembroUsuarioId,
      miembro_nombre: miembroUsuarioId ? nombresPorUsuario.get(miembroUsuarioId) || null : null,
      miembro_rol: nuevo?.rol_en_proyecto || anterior?.rol_en_proyecto || null,
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

  const documento = DOCUMENTOS[fila.tabla];
  if (documento) {
    const campoEstado = documento.estado;
    const cambioEstado =
      campoEstado && anterior && nuevo && anterior[campoEstado] !== nuevo[campoEstado]
        ? { de: anterior[campoEstado], a: nuevo[campoEstado] }
        : null;
    return {
      ...base,
      documento_id: fila.registro_id,
      documento_codigo: nuevo?.[documento.codigo] || anterior?.[documento.codigo] || null,
      documento_cambio_estado: cambioEstado,
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
  const idsUsuarios = [
    ...new Set(
      eventos.flatMap((e) => [
        e.usuario_id,
        e.tabla === "proyecto_equipo" ? comoObjeto(e.datos_nuevos)?.usuario_id : null,
        e.tabla === "proyecto_equipo" ? comoObjeto(e.datos_anteriores)?.usuario_id : null,
      ])
    ),
  ].filter(Boolean);
  const usuarios = await lineaTiempoRepositorio.listarUsuariosPorIds(pool, idsUsuarios);
  const nombresPorUsuario = new Map(usuarios.map((u) => [u.id, u.nombre]));

  return eventos.map((fila) => normalizarEvento(fila, nombresPorUsuario));
}

module.exports = { obtenerLineaTiempoProyecto };
