function formatearCodigoReq(anio, consecutivo) {
  return `REQ-${anio}-${String(consecutivo).padStart(3, "0")}`;
}

module.exports = { formatearCodigoReq };
