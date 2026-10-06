function formatearCodigoOC(anio, consecutivo) {
  return `OC-${anio}-${String(consecutivo).padStart(3, "0")}`;
}

module.exports = { formatearCodigoOC };
