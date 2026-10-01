function formatearCodigoPry(anio, consecutivo) {
  return `PRY-${anio}-${String(consecutivo).padStart(3, "0")}`;
}

module.exports = { formatearCodigoPry };
