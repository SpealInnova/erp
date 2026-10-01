const { crearApp } = require("./app");

const PORT = process.env.PORT || 3000;
const APP_ENV = process.env.APP_ENV || "desconocido";

const app = crearApp();

app.listen(PORT, () => {
  console.log(`SPEAL Project Control (${APP_ENV}) escuchando en puerto ${PORT}`);
});
