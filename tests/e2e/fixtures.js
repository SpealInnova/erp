const PASSWORD = "ClaveSegura123";

// El principal aprueba y versiona (Gerente General: todos los permisos); el
// colega es técnico, sin permisos restringidos (dominio/permisos.js).
const USUARIO_PRINCIPAL = {
  nombre: "QA Principal E2E",
  correo: "e2e.principal@speal.test",
  cargo: "Gerente General",
};

const USUARIO_COLEGA = {
  nombre: "QA Colega E2E",
  correo: "e2e.colega@speal.test",
  cargo: "Técnico Mantenimiento y Ensamble",
};

const PREFIJO_DATOS_E2E = "E2E";

module.exports = { PASSWORD, USUARIO_PRINCIPAL, USUARIO_COLEGA, PREFIJO_DATOS_E2E };
