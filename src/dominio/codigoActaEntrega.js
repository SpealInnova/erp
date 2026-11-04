function formatearCodigoAEE(anio, consecutivo) {
  return `AEE-${anio}-${String(consecutivo).padStart(3, "0")}`;
}

module.exports = { formatearCodigoAEE };
