function formatearCodigoACS(anio, consecutivo) {
  return `ACS-${anio}-${String(consecutivo).padStart(3, "0")}`;
}

module.exports = { formatearCodigoACS };
