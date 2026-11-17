const usuariosRepositorio = require("../repositorios/usuariosRepositorio");
const { PERMISOS, GERENTE_GENERAL, esSuperusuario, tienePermiso } = require("../dominio/permisos");
const { ErrorSinPermiso, ErrorAutoAprobacion } = require("../dominio/erroresPermisos");

const ACCIONES = {
  aprobar_oc: "Aprobar órdenes de compra",
  pagar_oc: "Marcar órdenes de compra como pagadas o contabilizadas",
  aprobar_cotizacion: "Decidir cotizaciones en aprobación",
  aprobar_diseno: "Liberar expedientes y aprobar cambios de diseño",
  cancelar_proyecto: "Cancelar o eliminar proyectos",
  versionar_proyecto: "Crear versiones de proyectos",
  versionar_cotizacion: "Crear versiones de cotizaciones",
  versionar_oc: "Crear versiones de órdenes de compra",
  versionar_acta: "Crear versiones de actas",
  versionar_reporte: "Crear versiones de reportes de servicio",
};

function mensajeSinPermiso(clave) {
  const cargos = [...PERMISOS[clave], GERENTE_GENERAL].join(", ");
  return `${ACCIONES[clave]} requiere uno de estos cargos: ${cargos}.`;
}

// Lee el usuario de la base y no del token: el token no trae el cargo, y así
// un cambio de cargo o una desactivación aplican de inmediato.
async function exigirPermiso(pool, usuarioId, clave) {
  const usuario = await usuariosRepositorio.buscarPorId(pool, usuarioId);
  if (!tienePermiso(usuario, clave)) {
    throw new ErrorSinPermiso(mensajeSinPermiso(clave));
  }
  return usuario;
}

// Separación de funciones: quien creó un documento no lo aprueba, salvo el
// Gerente General (o el rol admin).
function exigirOtroAprobador(usuario, creadoPor) {
  if (creadoPor && usuario.id === creadoPor && !esSuperusuario(usuario)) {
    throw new ErrorAutoAprobacion();
  }
}

module.exports = { exigirPermiso, exigirOtroAprobador, ACCIONES };
