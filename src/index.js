const { crearApp } = require("./app");
const { crearPool } = require("./config/db");
const { ejecutarMigraciones } = require("./migrador");

const PORT = process.env.PORT || 3000;
const APP_ENV = process.env.APP_ENV || "desconocido";

async function iniciar() {
  const poolMigraciones = crearPool();
  try {
    await ejecutarMigraciones(poolMigraciones);
    console.log("Migraciones al día.");
  } finally {
    await poolMigraciones.end();
  }

  const app = crearApp();
  app.listen(PORT, () => {
    console.log(`SPEAL Project Control (${APP_ENV}) escuchando en puerto ${PORT}`);
  });
}

iniciar().catch((error) => {
  console.error("No se pudo iniciar la aplicación (fallo en migraciones):", error);
  process.exit(1);
});
