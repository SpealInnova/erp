const proyectosRepositorio = require("../repositorios/proyectosRepositorio");
const documentosRepositorio = require("../repositorios/proyectoDocumentosRepositorio");
const { ErrorProyectoNoEncontrado } = require("../dominio/erroresProyectos");

// Estados de OC en los que el dinero ya salió.
const ESTADOS_OC_PAGADA = ["paga", "contabilizada"];

// Cada documento trae "alertas": enlaces que no cuadran con el proyecto. Las
// reglas nuevas impiden crearlos, pero pueden venir de registros anteriores.
function alertasCliente(documento, proyecto) {
  return Number(documento.cliente_id) === Number(proyecto.cliente_id)
    ? []
    : ["Cliente distinto al del proyecto"];
}

// Un reporte puede estar en este proyecto o en otro del mismo cliente (si el
// equipo es de este proyecto, p. ej. un mantenimiento posterior): en ese caso
// se anota dónde quedó. Solo es alerta si se cruzan clientes.
function revisarReporte(reporte, proyecto) {
  const mismo = (a, b) => Number(a) === Number(b);
  const enEsteProyecto = mismo(reporte.proyecto_id, proyecto.id);
  const alertas = [];
  if (enEsteProyecto) {
    if (!mismo(reporte.cliente_id, proyecto.cliente_id)) {
      alertas.push("Cliente distinto al del proyecto");
    }
    if (
      reporte.cliente_equipo_id !== null &&
      !mismo(reporte.cliente_equipo_id, proyecto.cliente_id)
    ) {
      alertas.push("El equipo es de otro cliente");
    }
  } else if (!mismo(reporte.cliente_id, reporte.cliente_equipo_id)) {
    alertas.push("Registrado a nombre de otro cliente");
  }
  return {
    ...reporte,
    nota: enEsteProyecto ? null : `Registrado en ${reporte.proyecto_codigo}`,
    alertas,
  };
}

async function obtenerDocumentosProyecto(pool, proyectoId) {
  const proyecto = await proyectosRepositorio.obtenerPorId(pool, proyectoId);
  if (!proyecto) {
    throw new ErrorProyectoNoEncontrado();
  }

  const [
    cotizacion,
    expedientes,
    requisiciones,
    ordenes,
    reportes,
    actasEntrega,
    actasCierre,
    equipos,
  ] = await Promise.all([
    proyecto.cotizacion_id
      ? documentosRepositorio.obtenerCotizacion(pool, proyecto.cotizacion_id)
      : Promise.resolve(null),
    documentosRepositorio.listarExpedientes(pool, proyectoId),
    documentosRepositorio.listarRequisiciones(pool, proyectoId),
    documentosRepositorio.listarOrdenesCompra(pool, proyectoId),
    documentosRepositorio.listarReportesServicio(pool, proyectoId),
    documentosRepositorio.listarActasEntrega(pool, proyectoId),
    documentosRepositorio.listarActasCierre(pool, proyectoId),
    documentosRepositorio.listarEquipos(pool, proyectoId),
  ]);

  const sumar = (lista) => lista.reduce((t, x) => t + x.valor, 0);

  return {
    resumen: {
      valor_cotizado: cotizacion ? cotizacion.valor : null,
      comprometido_oc: sumar(ordenes),
      pagado_oc: sumar(ordenes.filter((o) => ESTADOS_OC_PAGADA.includes(o.estado))),
    },
    cotizacion,
    expedientes,
    requisiciones,
    ordenes_compra: ordenes,
    reportes_servicio: reportes.map((r) => revisarReporte(r, proyecto)),
    equipos,
    actas_entrega: actasEntrega.map((a) => {
      const alertas = alertasCliente(a, proyecto);
      if (a.equipos_de_otro_proyecto > 0) {
        alertas.push(`${a.equipos_de_otro_proyecto} equipo(s) de otro proyecto`);
      }
      return { ...a, alertas };
    }),
    actas_cierre: actasCierre.map((a) => {
      const alertas = alertasCliente(a, proyecto);
      if (
        a.acta_entrega_proyecto_id !== null &&
        Number(a.acta_entrega_proyecto_id) !== Number(proyecto.id)
      ) {
        alertas.push(`El acta de entrega ${a.acta_entrega_numero} es de otro proyecto`);
      }
      return { ...a, alertas };
    }),
  };
}

module.exports = { obtenerDocumentosProyecto };
