// Un documento quedaría enlazado a un proyecto, cliente, equipo o acta que no
// le corresponde (p. ej. un reporte de servicio con el equipo de otro
// proyecto). El mensaje nombra los códigos para que el usuario sepa qué corregir.
class ErrorEnlaceInconsistente extends Error {}

module.exports = { ErrorEnlaceInconsistente };
