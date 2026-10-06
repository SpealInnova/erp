function formatearCodigoRST(anio, consecutivo) {
  return `RST-${anio}-${String(consecutivo).padStart(3, "0")}`;
}

module.exports = { formatearCodigoRST };
