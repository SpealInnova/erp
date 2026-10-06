function formatearCodigoExp(anio, consecutivo) {
  return `EXP-${anio}-${String(consecutivo).padStart(3, "0")}`;
}

module.exports = { formatearCodigoExp };
