const { ZodError } = require("zod");
const {
  ErrorCredencialesInvalidas,
  ErrorUsuarioInactivo,
  ErrorUsuarioBloqueado,
  ErrorTokenInvalido,
} = require("../dominio/erroresAuth");
const { ErrorClienteNoEncontrado, ErrorIdentificacionDuplicada } = require("../dominio/erroresClientes");
const {
  ErrorProyectoNoEncontrado,
  ErrorClienteInvalido,
  ErrorResponsableInvalido,
} = require("../dominio/erroresProyectos");
const { ErrorTransicionInvalida } = require("../dominio/erroresEstado");
const {
  ErrorCotizacionNoEncontrada,
  ErrorClienteNoExiste,
  ErrorAsesorNoExiste,
  ErrorCotizacionNoEditable,
  ErrorItemsVacios,
} = require("../dominio/erroresCotizaciones");
const { ErrorProveedorNoEncontrado, ErrorNitDuplicado } = require("../dominio/erroresProveedores");
const {
  ErrorRequisicionNoEncontrada,
  ErrorProyectoNoExiste,
  ErrorRequisicionNoEditable,
  ErrorItemsVacios: ErrorItemsVaciosRequisicion,
} = require("../dominio/erroresRequisiciones");
const {
  ErrorOrdenCompraNoEncontrada,
  ErrorRequisicionNoExiste,
  ErrorProveedorNoExiste,
  ErrorOrdenCompraNoEditable,
  ErrorItemsVacios: ErrorItemsVaciosOC,
} = require("../dominio/erroresOrdenesCompra");
const {
  ErrorExpedienteNoEncontrado,
  ErrorProyectoNoExiste: ErrorProyectoNoExisteExpediente,
  ErrorResponsableNoExiste,
  ErrorExpedienteNoEditable,
  ErrorNumeroSerieDuplicado,
} = require("../dominio/erroresExpedientesDiseno");
const { ErrorRequisitoNoEncontrado } = require("../dominio/erroresRequisitosEntrada");
const { ErrorSalidaNoEncontrada } = require("../dominio/erroresSalidasDiseno");
const { ErrorVerificacionNoEncontrada } = require("../dominio/erroresVerificaciones");
const { ErrorValidacionNoEncontrada } = require("../dominio/erroresValidaciones");
const { ErrorRevisionNoEncontrada } = require("../dominio/erroresRevisionesDiseno");
const { ErrorRiesgoNoEncontrado } = require("../dominio/erroresRiesgosDiseno");
const { ErrorCambioNoEncontrado } = require("../dominio/erroresCambiosDiseno");
const { ErrorTransferenciaNoEncontrada } = require("../dominio/erroresTransferencias");
const {
  ErrorReporteNoEncontrado,
  ErrorEquipoNoExiste,
  ErrorClienteNoExiste: ErrorClienteNoExisteReporte,
  ErrorProyectoNoExiste: ErrorProyectoNoExisteReporte,
} = require("../dominio/erroresReportesServicioTecnico");
const { ErrorParametroNoEncontrado } = require("../dominio/erroresParametrosMedidos");
const {
  ErrorActaNoEncontrada,
  ErrorProyectoNoExiste: ErrorProyectoNoExisteActa,
  ErrorClienteNoExiste: ErrorClienteNoExisteActa,
  ErrorItemsVacios: ErrorItemsVaciosActa,
} = require("../dominio/erroresActasCierre");

// eslint-disable-next-line no-unused-vars
function manejadorErrores(error, req, res, next) {
  if (error instanceof ZodError) {
    return res.status(400).json({ error: "Datos inválidos", detalles: error.issues });
  }
  if (error instanceof ErrorCredencialesInvalidas) {
    return res.status(401).json({ error: error.message });
  }
  if (error instanceof ErrorUsuarioInactivo) {
    return res.status(403).json({ error: error.message });
  }
  if (error instanceof ErrorUsuarioBloqueado) {
    return res.status(423).json({ error: error.message, bloqueadoHasta: error.bloqueadoHasta });
  }
  if (error instanceof ErrorTokenInvalido) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof ErrorClienteNoEncontrado) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof ErrorIdentificacionDuplicada) {
    return res.status(409).json({ error: error.message });
  }
  if (error instanceof ErrorProyectoNoEncontrado) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof ErrorClienteInvalido || error instanceof ErrorResponsableInvalido) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof ErrorTransicionInvalida) {
    return res.status(409).json({
      error: error.message,
      estadoActual: error.estadoActual,
      estadoDestino: error.estadoDestino,
    });
  }
  if (error instanceof ErrorCotizacionNoEncontrada) {
    return res.status(404).json({ error: error.message });
  }
  if (
    error instanceof ErrorClienteNoExiste ||
    error instanceof ErrorAsesorNoExiste ||
    error instanceof ErrorItemsVacios
  ) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof ErrorCotizacionNoEditable) {
    return res.status(409).json({ error: error.message });
  }
  if (error instanceof ErrorProveedorNoEncontrado) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof ErrorNitDuplicado) {
    return res.status(409).json({ error: error.message });
  }
  if (error instanceof ErrorRequisicionNoEncontrada) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof ErrorProyectoNoExiste || error instanceof ErrorItemsVaciosRequisicion) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof ErrorRequisicionNoEditable) {
    return res.status(409).json({ error: error.message });
  }
  if (error instanceof ErrorOrdenCompraNoEncontrada) {
    return res.status(404).json({ error: error.message });
  }
  if (
    error instanceof ErrorRequisicionNoExiste ||
    error instanceof ErrorProveedorNoExiste ||
    error instanceof ErrorItemsVaciosOC
  ) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof ErrorOrdenCompraNoEditable) {
    return res.status(409).json({ error: error.message });
  }
  if (error instanceof ErrorExpedienteNoEncontrado) {
    return res.status(404).json({ error: error.message });
  }
  if (
    error instanceof ErrorProyectoNoExisteExpediente ||
    error instanceof ErrorResponsableNoExiste
  ) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof ErrorExpedienteNoEditable) {
    return res.status(409).json({ error: error.message });
  }
  if (error instanceof ErrorNumeroSerieDuplicado) {
    return res.status(409).json({ error: error.message });
  }
  if (error instanceof ErrorRequisitoNoEncontrado || error instanceof ErrorSalidaNoEncontrada) {
    return res.status(404).json({ error: error.message });
  }
  if (
    error instanceof ErrorVerificacionNoEncontrada ||
    error instanceof ErrorValidacionNoEncontrada ||
    error instanceof ErrorRevisionNoEncontrada
  ) {
    return res.status(404).json({ error: error.message });
  }
  if (
    error instanceof ErrorRiesgoNoEncontrado ||
    error instanceof ErrorCambioNoEncontrado ||
    error instanceof ErrorTransferenciaNoEncontrada
  ) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof ErrorReporteNoEncontrado) {
    return res.status(404).json({ error: error.message });
  }
  if (
    error instanceof ErrorEquipoNoExiste ||
    error instanceof ErrorClienteNoExisteReporte ||
    error instanceof ErrorProyectoNoExisteReporte
  ) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof ErrorParametroNoEncontrado) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof ErrorActaNoEncontrada) {
    return res.status(404).json({ error: error.message });
  }
  if (
    error instanceof ErrorProyectoNoExisteActa ||
    error instanceof ErrorClienteNoExisteActa ||
    error instanceof ErrorItemsVaciosActa
  ) {
    return res.status(400).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: "Error interno" });
}

module.exports = { manejadorErrores };
