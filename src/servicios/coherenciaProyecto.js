const proyectosRepositorio = require("../repositorios/proyectosRepositorio");
const clientesRepositorio = require("../repositorios/clientesRepositorio");
const { ErrorEnlaceInconsistente } = require("../dominio/erroresEnlaces");

// Reglas que mantienen conectados los documentos con su proyecto: reportes de
// servicio y actas deben quedar a nombre del cliente del proyecto, sus equipos
// deben ser del mismo proyecto y un acta de cierre solo puede cerrar un acta
// de entrega de ese proyecto.

async function codigoDeProyecto(pool, proyectoId) {
  const proyecto = await proyectosRepositorio.obtenerPorId(pool, proyectoId);
  return proyecto ? proyecto.codigo_pry : "otro proyecto";
}

async function exigirClienteDelProyecto(pool, proyecto, clienteId) {
  if (Number(clienteId) === Number(proyecto.cliente_id)) return;
  const cliente = await clientesRepositorio.obtenerPorId(pool, proyecto.cliente_id);
  const nombre = cliente ? cliente.nombre_razon_social : "registrado en el proyecto";
  throw new ErrorEnlaceInconsistente(
    `El proyecto ${proyecto.codigo_pry} es del cliente ${nombre}; el documento debe quedar a nombre de ese mismo cliente.`
  );
}

// equipo: fila de expedientes_diseno (al menos id y proyecto_id).
async function exigirEquipoDelProyecto(pool, equipo, numeroSerie, proyecto) {
  if (Number(equipo.proyecto_id) === Number(proyecto.id)) return;
  const codigo = await codigoDeProyecto(pool, equipo.proyecto_id);
  throw new ErrorEnlaceInconsistente(
    `El equipo con número de serie ${numeroSerie} pertenece al proyecto ${codigo}, no al ${proyecto.codigo_pry}.`
  );
}

async function exigirActaEntregaDelProyecto(pool, actaEntrega, proyecto) {
  if (Number(actaEntrega.proyecto_id) === Number(proyecto.id)) return;
  const codigo = await codigoDeProyecto(pool, actaEntrega.proyecto_id);
  throw new ErrorEnlaceInconsistente(
    `El acta de entrega ${actaEntrega.numero_acta} es del proyecto ${codigo}, no del ${proyecto.codigo_pry}.`
  );
}

module.exports = {
  exigirClienteDelProyecto,
  exigirEquipoDelProyecto,
  exigirActaEntregaDelProyecto,
};
