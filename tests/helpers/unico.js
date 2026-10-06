const crypto = require("crypto");

function sufijoUnico() {
  return crypto.randomBytes(4).toString("hex");
}

module.exports = { sufijoUnico };
