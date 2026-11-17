const { CARGOS } = require("./catalogoCargos");

// Matriz de permisos por cargo (decisión del usuario, 2026-11-13). Vive en el
// código, sin tabla: cambiar quién aprueba requiere un despliegue. Los cargos
// son los textos exactos del catálogo. El rol "admin" y el Gerente General
// tienen todos los permisos.
const ROL_ADMIN = "admin";
const GERENTE_GENERAL = "Gerente General";

const DIR_ADMINISTRATIVO = "Director Administrativo y Financiero";
const DIR_OPERACIONES = "Director de Operaciones y Producción";
const JEFE_PROYECTOS = "Jefe de Proyectos";
const JEFE_SIG = "Jefe Sistema Integrado De Gestion";

const PERMISOS = {
  // Pasar una OC de "pendiente de aprobar" a "aprobada, pendiente de pago".
  aprobar_oc: [DIR_ADMINISTRATIVO],
  // Marcar una OC como pagada o contabilizada.
  pagar_oc: [DIR_ADMINISTRATIVO, "Contador General", "Auxiliar contable"],
  // Decidir una cotización que está en aprobación (enviarla o devolverla).
  aprobar_cotizacion: ["Gerente Comercial"],
  // Liberar un expediente de diseño y aprobar o rechazar cambios de diseño.
  aprobar_diseno: [DIR_OPERACIONES, "Jefe de I+D+i"],
  // Cancelar un proyecto o eliminarlo (si no tiene documentos).
  cancelar_proyecto: [DIR_OPERACIONES, JEFE_PROYECTOS],
  // Nuevas versiones de documentos ya emitidos.
  versionar_proyecto: [DIR_OPERACIONES, JEFE_PROYECTOS],
  versionar_cotizacion: ["Gerente Comercial", "Coordinador Comercial"],
  versionar_oc: [DIR_ADMINISTRATIVO, "Coordinador de Compras"],
  versionar_acta: [DIR_OPERACIONES, JEFE_PROYECTOS, "Jefe de Produccion e Instalaciones", JEFE_SIG],
  versionar_reporte: [DIR_OPERACIONES, "Jefe de Soporte Tecnico y mantenimiento", JEFE_SIG],
};

// Un error de digitación en un cargo dejaría el permiso sin nadie: se detecta
// al cargar el módulo (y en las pruebas), no en producción.
for (const [clave, cargos] of Object.entries(PERMISOS)) {
  for (const cargo of cargos) {
    if (!CARGOS.includes(cargo)) {
      throw new Error(`Permiso "${clave}": el cargo "${cargo}" no está en el catálogo`);
    }
  }
}

const CLAVES = Object.keys(PERMISOS);

// Usuarios creados antes del catálogo cerrado pueden tener el cargo con otra
// tilde, mayúsculas o espacios ("Jefe de Producción e Instalaciones"): se
// comparan normalizados para que no pierdan sus permisos por eso.
function normalizarCargo(cargo) {
  return String(cargo || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const CARGOS_NORMALIZADOS = Object.fromEntries(
  Object.entries(PERMISOS).map(([clave, cargos]) => [clave, cargos.map(normalizarCargo)])
);

function esSuperusuario(usuario) {
  return (
    Boolean(usuario) &&
    (usuario.rol === ROL_ADMIN ||
      normalizarCargo(usuario.cargo) === normalizarCargo(GERENTE_GENERAL))
  );
}

function tienePermiso(usuario, clave) {
  if (!PERMISOS[clave]) {
    throw new Error(`Permiso desconocido: ${clave}`);
  }
  if (!usuario || !usuario.activo) {
    return false;
  }
  return (
    esSuperusuario(usuario) || CARGOS_NORMALIZADOS[clave].includes(normalizarCargo(usuario.cargo))
  );
}

function permisosDe(usuario) {
  return CLAVES.filter((clave) => tienePermiso(usuario, clave));
}

module.exports = {
  PERMISOS,
  CLAVES,
  ROL_ADMIN,
  GERENTE_GENERAL,
  esSuperusuario,
  tienePermiso,
  permisosDe,
};
