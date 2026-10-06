function formatearCodigoCot(anio, consecutivo) {
  return `COT-${anio}-${String(consecutivo).padStart(3, "0")}`;
}

module.exports = { formatearCodigoCot };
