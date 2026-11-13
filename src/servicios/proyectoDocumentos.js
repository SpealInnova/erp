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

function alertasReporte(reporte, proyecto) {
  const alertas = alertasCliente(reporte, proyecto);
  if (reporte.proyecto_id === null) {
    alertas.push("Registrado sin proyecto; el equipo es de este proyecto");
  } else if (Number(reporte.proyecto_id) !== Number(proyecto.id)) {
    alertas.push("Registrado en otro proyecto; el equipo es de este proyecto");
  } else if (
    reporte.proyecto_equipo_id !== null &&
    Number(reporte.proyecto_equipo_id) !== Number(proyecto.id)
  ) {
    alertas.push("El equipo pertenece a otro proyecto");
  }
  return alertas;
}

async function obtenerDocumentosProyecto(pool, proyectoId) {
  const proyecto = await proyectosRepositorio.obtenerPorId(pool, proyectoId);
  if (!proyecto) {
    throw new ErrorProyectoNoEncontrado();
  }

  const [cotizacion, expedientes, requisiciones, ordenes, reportes, actasEntrega, actasCierre] =
    await Promise.all([
      proyecto.cotizacion_id
        ? documentosRepositorio.obtenerCotizacion(pool, proyecto.cotizacion_id)
        : Promise.resolve(null),
      documentosRepositorio.listarExpedientes(pool, proyectoId),
      documentosRepositorio.listarRequisiciones(pool, proyectoId),
      documentosRepositorio.listarOrdenesCompra(pool, proyectoId),
      documentosRepositorio.listarReportesServicio(pool, proyectoId),
      documentosRepositorio.listarActasEntrega(pool, proyectoId),
      documentosRepositorio.listarActasCierre(pool, proyectoId),
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
    reportes_servicio: reportes.map((r) => ({ ...r, alertas: alertasReporte(r, proyecto) })),
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
