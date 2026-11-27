// Tipos de servicio técnico (formato FO-ST-005) y su nombre para mostrar.
const TEXTO_TIPO_SERVICIO = {
  instalacion: "Instalación",
  inspeccion: "Inspección",
  asistencia: "Asistencia",
  mantenimiento_preventivo: "Mantenimiento preventivo",
  mantenimiento_correctivo: "Mantenimiento correctivo",
  garantia: "Garantía",
  validacion: "Validación",
};

const TIPOS_SERVICIO = Object.keys(TEXTO_TIPO_SERVICIO);

module.exports = { TEXTO_TIPO_SERVICIO, TIPOS_SERVICIO };
