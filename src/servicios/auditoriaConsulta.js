const auditoriaRepositorio = require("../repositorios/auditoriaRepositorio");
const { aLimites } = require("../repositorios/consultaListado");
const { exigirPermiso } = require("./autorizacion");

/* Pantalla de auditoría: quién cambió qué y cuándo en el ERP. Solo la ven el
   rol admin y el Gerente General (permiso ver_auditoria). Cada fila llega
   lista para mostrar: módulo, documento, enlace y los campos que cambiaron. */

// Módulo legible de cada tabla auditada y, cuando aplica, su enlace en el ERP.
const MODULOS = {
  proyectos: { etiqueta: "Proyecto", enlace: (id) => `#/proyectos/${id}` },
  proyecto_actividades: {
    etiqueta: "Actividad del proyecto",
    enlace: (id, d) => (d.proyecto_id ? `#/proyectos/${d.proyecto_id}/actividades/${id}` : null),
  },
  proyecto_equipo: {
    etiqueta: "Equipo del proyecto",
    enlace: (id, d) => (d.proyecto_id ? `#/proyectos/${d.proyecto_id}` : null),
  },
  proyecto_fase_responsables: {
    etiqueta: "Responsable de etapa",
    enlace: (id, d) => (d.proyecto_id ? `#/proyectos/${d.proyecto_id}` : null),
  },
  clientes: { etiqueta: "Cliente", enlace: (id) => `#/clientes/${id}` },
  cotizaciones: { etiqueta: "Cotización", enlace: (id) => `#/cotizaciones/${id}` },
  proveedores: { etiqueta: "Proveedor", enlace: (id) => `#/proveedores/${id}` },
  requisiciones: { etiqueta: "Requisición", enlace: (id) => `#/requisiciones/${id}` },
  ordenes_compra: { etiqueta: "Orden de compra", enlace: (id) => `#/ordenes-compra/${id}` },
  expedientes_diseno: {
    etiqueta: "Expediente de diseño",
    enlace: (id) => `#/expedientes-diseno/${id}`,
  },
  requisitos_entrada: { etiqueta: "Requisito de entrada", deExpediente: true },
  salidas_diseno: { etiqueta: "Salida de diseño", deExpediente: true },
  verificaciones: { etiqueta: "Verificación", deExpediente: true },
  validaciones: { etiqueta: "Validación", deExpediente: true },
  revisiones_diseno: { etiqueta: "Revisión de diseño", deExpediente: true },
  riesgos_diseno: { etiqueta: "Riesgo de diseño", deExpediente: true },
  cambios_diseno: { etiqueta: "Cambio de diseño", deExpediente: true },
  transferencias: { etiqueta: "Transferencia", deExpediente: true },
  equipos: { etiqueta: "Equipo instalado", enlace: (id) => `#/equipos/${id}` },
  reportes_servicio_tecnico: {
    etiqueta: "Reporte de servicio",
    enlace: (id) => `#/reportes-servicio/${id}`,
  },
  parametros_medidos: {
    etiqueta: "Parámetro medido",
    enlace: (id, d) => (d.reporte_id ? `#/reportes-servicio/${d.reporte_id}` : null),
  },
  actas_entrega_equipos: { etiqueta: "Acta de entrega", enlace: (id) => `#/actas-entrega/${id}` },
  actas_cierre_satisfaccion: {
    etiqueta: "Acta de cierre",
    enlace: (id) => `#/actas-cierre/${id}`,
  },
  archivos_adjuntos: { etiqueta: "Evidencia" },
  tareas: { etiqueta: "Tarea", enlace: (id) => `#/tareas/${id}` },
  usuarios: { etiqueta: "Usuario", enlace: (id) => `#/usuarios/${id}/editar` },
  copias_seguridad: { etiqueta: "Copia de seguridad", enlace: () => "#/copias" },
};

// Lo que identifica al documento, en orden de preferencia.
const CAMPOS_IDENTIFICADORES = [
  "codigo_pry",
  "numero_cotizacion",
  "numero_requisicion",
  "numero_oc",
  "codigo_expediente",
  "numero_reporte",
  "numero_acta",
  "numero_serie",
  "nombre_razon_social",
  "razon_social",
  "nombre_archivo",
  "archivo_nombre",
  "nombre",
  "titulo",
  "parametro",
  "descripcion",
  "requisito",
  "salida",
  "peligro",
];

// Columnas que cambian con cualquier edición y no dicen nada a quien revisa.
const CAMPOS_TECNICOS = new Set(["updated_at", "updated_by", "created_at", "created_by"]);
// Nunca se muestran, aunque llegaran en los datos.
const CAMPO_SENSIBLE = /password|token|secret|hash/i;
const LARGO_MAXIMO = 120;

function comoObjeto(valor) {
  if (!valor) return null;
  if (typeof valor === "object") return valor;
  try {
    return JSON.parse(valor);
  } catch {
    return null;
  }
}

function textoCorto(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const texto = typeof valor === "object" ? JSON.stringify(valor) : String(valor);
  return texto.length > LARGO_MAXIMO ? `${texto.slice(0, LARGO_MAXIMO - 1)}…` : texto;
}

function identificador(datos) {
  for (const campo of CAMPOS_IDENTIFICADORES) {
    if (datos[campo] !== null && datos[campo] !== undefined && datos[campo] !== "") {
      return textoCorto(datos[campo]);
    }
  }
  return null;
}

// Campos que cambiaron entre la versión anterior y la nueva.
function camposCambiados(anterior, nuevo) {
  if (!anterior || !nuevo) return [];
  const claves = new Set([...Object.keys(anterior), ...Object.keys(nuevo)]);
  return [...claves]
    .filter((c) => !CAMPOS_TECNICOS.has(c) && !CAMPO_SENSIBLE.test(c))
    .filter((c) => JSON.stringify(anterior[c] ?? null) !== JSON.stringify(nuevo[c] ?? null))
    .map((campo) => ({
      campo,
      antes: textoCorto(anterior[campo]),
      despues: textoCorto(nuevo[campo]),
    }));
}

function enlaceDe(modulo, registroId, datos) {
  if (!modulo) return null;
  if (modulo.deExpediente) {
    return datos.expediente_id ? `#/expedientes-diseno/${datos.expediente_id}` : null;
  }
  return modulo.enlace ? modulo.enlace(registroId, datos) : null;
}

function armarFila(fila) {
  const anterior = comoObjeto(fila.datos_anteriores);
  const nuevo = comoObjeto(fila.datos_nuevos);
  const datos = nuevo || anterior || {};
  const modulo = MODULOS[fila.tabla];
  return {
    id: fila.id,
    creado_en: fila.creado_en,
    usuario_id: fila.usuario_id,
    usuario_nombre: fila.usuario_nombre || null,
    accion: fila.accion,
    tabla: fila.tabla,
    modulo: modulo ? modulo.etiqueta : fila.tabla,
    registro_id: fila.registro_id,
    documento: identificador(datos),
    // un registro eliminado ya no se puede abrir
    enlace: fila.accion === "eliminar" ? null : enlaceDe(modulo, fila.registro_id, datos),
    cambios: fila.accion === "actualizar" ? camposCambiados(anterior, nuevo) : [],
  };
}

async function listarAuditoria(pool, usuarioId, filtros) {
  await exigirPermiso(pool, usuarioId, "ver_auditoria");
  const { filas, total } = await auditoriaRepositorio.listar(pool, {
    ...aLimites(filtros),
    q: filtros.q,
    desde: filtros.desde,
    hasta: filtros.hasta,
    usuarioId: filtros.usuario_id,
    tabla: filtros.tabla,
    accion: filtros.accion,
    registroId: filtros.registro_id,
  });
  return {
    registros: filas.map(armarFila),
    total,
    pagina: filtros.pagina,
    tamanoPagina: filtros.tamanoPagina,
    modulos: Object.entries(MODULOS)
      .map(([tabla, m]) => ({ tabla, etiqueta: m.etiqueta }))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es")),
  };
}

module.exports = { listarAuditoria, camposCambiados, armarFila, MODULOS };
