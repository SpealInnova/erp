/* global location */
// Revisión automática de un sitio publicado del ERP (staging o producción), de SOLO LECTURA.
//
// Inicia sesión una vez, abre cada pantalla en un navegador y avisa si alguna da error. No crea
// ni cambia nada: toda petición que no sea de lectura se bloquea antes de salir del navegador y
// se reporta como falla. Detalle en docs/REVISION_DE_SITIO.md.
//
// Uso:  npm run revisar:staging
//       node scripts/revisar-sitio.js <url-del-sitio>
//
// Credenciales: REVISION_CORREO y REVISION_PASSWORD, de variables de entorno o del archivo
// ~/.erp-revision.env (fuera del repositorio; REVISION_ARCHIVO cambia la ruta). Este script
// nunca las imprime.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("@playwright/test");

const ARCHIVO_CREDENCIALES =
  process.env.REVISION_ARCHIVO || path.join(os.homedir(), ".erp-revision.env");
require("dotenv").config({ path: ARCHIVO_CREDENCIALES });

const CARPETA_CAPTURAS = path.join(__dirname, "..", "test-results", "revision");
const SEGUNDOS_LENTA = 5;
const ESPERA_MAXIMA_MS = 45000;

// Pantallas que se abren por su dirección (las de enrutarRuta en src/public/js/inicio.js).
const PANTALLAS = [
  "inicio",
  "tareas",
  "tablero",
  "tiempos",
  "comercial",
  "compras",
  "diseno",
  "soporte",
  "entregas",
  "clientes",
  "proyectos",
  "cotizaciones",
  "proveedores",
  "requisiciones",
  "ordenes-compra",
  "expedientes-diseno",
  "reportes-servicio",
  "equipos",
  "listado-servicios",
  "actas-entrega",
  "actas-cierre",
  "usuarios",
  "copias",
  "auditoria",
];

// Formularios de creación: se abren, nunca se guardan.
const FORMULARIOS_NUEVOS = [
  "tareas/nueva",
  "clientes/nuevo",
  "proyectos/nuevo",
  "cotizaciones/nuevo",
  "proveedores/nuevo",
  "requisiciones/nuevo",
  "ordenes-compra/nuevo",
  "expedientes-diseno/nuevo",
  "reportes-servicio/nuevo",
  "equipos/nuevo",
  "actas-entrega/nuevo",
  "actas-cierre/nuevo",
  "usuarios/nuevo",
];

// El primer registro de cada lista: `api` es el listado del servidor de donde sale su id.
const DETALLES = [
  { api: "/tareas", ruta: (id) => `tareas/${id}` },
  { api: "/clientes", ruta: (id) => `clientes/${id}` },
  { api: "/proyectos", ruta: (id) => `proyectos/${id}`, conPestanas: true },
  { api: "/cotizaciones", ruta: (id) => `cotizaciones/${id}` },
  { api: "/proveedores", ruta: (id) => `proveedores/${id}` },
  { api: "/requisiciones", ruta: (id) => `requisiciones/${id}` },
  { api: "/ordenes-compra", ruta: (id) => `ordenes-compra/${id}` },
  { api: "/expedientes-diseno", ruta: (id) => `expedientes-diseno/${id}` },
  { api: "/reportes-servicio-tecnico", ruta: (id) => `reportes-servicio/${id}` },
  { api: "/equipos", ruta: (id) => `equipos/${id}` },
  { api: "/actas-entrega-equipos", ruta: (id) => `actas-entrega/${id}` },
  { api: "/actas-cierre-satisfaccion", ruta: (id) => `actas-cierre/${id}` },
  { api: "/usuarios", ruta: (id) => `usuarios/${id}/editar` },
];

// Lo que se observa mientras se revisa una pantalla (se reinicia en cada una).
let problemas = [];
let peticionesEnCurso = 0;
let saliendo = false;
const resultados = [];

function salirConError(mensaje) {
  console.error(`\n${mensaje}`);
  process.exit(1);
}

function leerArgumentos() {
  const url = process.argv[2];
  if (!url || !/^https?:\/\//.test(url)) {
    salirConError(
      "Falta la dirección del sitio. Ejemplo: node scripts/revisar-sitio.js https://erp-test.speal-pad.com"
    );
  }
  const correo = process.env.REVISION_CORREO;
  const password = process.env.REVISION_PASSWORD;
  if (!correo || !password) {
    salirConError(
      `Faltan las credenciales. Crea el archivo ${ARCHIVO_CREDENCIALES} con:\n` +
        "  REVISION_CORREO=tu-correo\n  REVISION_PASSWORD=tu-contraseña\n" +
        "(ver docs/REVISION_DE_SITIO.md)"
    );
  }
  return { base: url.replace(/\/+$/, ""), correo, password };
}

async function revisarServidor(base) {
  for (const ruta of ["/health", "/health/db"]) {
    let estado;
    try {
      estado = (await fetch(`${base}${ruta}?v=${Date.now()}`)).status;
    } catch (error) {
      estado = error.cause?.code || error.message;
    }
    if (estado !== 200)
      salirConError(`El servidor no responde bien en ${ruta} (${estado}). Se detiene la revisión.`);
  }
  console.log("Servidor y base de datos: OK");
}

// Bloquea toda escritura. El único POST permitido es el primer inicio de sesión.
async function protegerSoloLectura(contexto) {
  let loginPermitido = true;
  await contexto.route("**/*", (ruta) => {
    const peticion = ruta.request();
    const metodo = peticion.method();
    const camino = new URL(peticion.url()).pathname;
    if (metodo === "GET" || metodo === "HEAD") return ruta.continue();
    if (metodo === "POST" && camino === "/auth/login" && loginPermitido) {
      loginPermitido = false;
      return ruta.continue();
    }
    problemas.push(`Intentó escribir: ${metodo} ${camino} (se bloqueó, no llegó al servidor)`);
    return ruta.abort("blockedbyclient");
  });
}

function observar(pagina) {
  pagina.on("dialog", (dialogo) => dialogo.dismiss().catch(() => {}));
  pagina.on("pageerror", (error) => problemas.push(`Error de JavaScript: ${error.message}`));
  pagina.on("console", (mensaje) => {
    // Los recursos que no cargan ya se reportan por su respuesta o su fallo
    if (mensaje.type() === "error" && !mensaje.text().startsWith("Failed to load resource")) {
      problemas.push(`Consola: ${mensaje.text()}`);
    }
  });
  pagina.on("response", (respuesta) => {
    if (respuesta.status() >= 400) {
      const camino = new URL(respuesta.url()).pathname;
      problemas.push(
        `Servidor: ${respuesta.status()} en ${respuesta.request().method()} ${camino}`
      );
    }
  });
  pagina.on("request", () => peticionesEnCurso++);
  pagina.on("requestfinished", () => peticionesEnCurso--);
  pagina.on("requestfailed", (peticion) => {
    peticionesEnCurso--;
    const error = peticion.failure()?.errorText || "";
    // Las escrituras bloqueadas ya se reportaron; lo que se cancela al dejar la pantalla
    // anterior lo cancela este script, no el sitio.
    if (error.includes("ERR_BLOCKED_BY_CLIENT")) return;
    if (saliendo && error.includes("ERR_ABORTED")) return;
    problemas.push(`No cargó: ${new URL(peticion.url()).pathname} (${error})`);
  });
}

async function iniciarSesion(pagina, { base, correo, password }) {
  await pagina.goto(`${base}/login`, { timeout: ESPERA_MAXIMA_MS });
  await pagina.fill("#correo", correo);
  await pagina.fill("#password", password);
  const [respuesta] = await Promise.all([
    pagina.waitForResponse(
      (r) => r.url().endsWith("/auth/login") && r.request().method() === "POST"
    ),
    pagina.click("#boton-login"),
  ]);
  if (respuesta.status() !== 200) {
    const cuerpo = await respuesta.json().catch(() => ({}));
    salirConError(
      `No se pudo iniciar sesión (${respuesta.status()}${cuerpo.error ? `: ${cuerpo.error}` : ""}).\n` +
        `Revisa el correo y la contraseña en ${ARCHIVO_CREDENCIALES}. ` +
        "No se reintenta, para no bloquear la cuenta."
    );
  }
  await pagina.waitForURL("**/inicio", { timeout: ESPERA_MAXIMA_MS });
  console.log("Inicio de sesión: OK\n");
}

// Id del primer registro de cada lista, leído del servidor con la sesión del navegador.
async function buscarPrimerosIds(pagina) {
  return pagina.evaluate(
    async (listas) => {
      const token = sessionStorage.getItem("erp_token");
      const ids = {};
      for (const api of listas) {
        const r = await fetch(`${api}?tamanoPagina=1`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.status !== 200) {
          ids[api] = { error: r.status };
          continue;
        }
        const cuerpo = await r.json();
        const lista = Array.isArray(cuerpo)
          ? cuerpo
          : Object.values(cuerpo).find(
              (v) => Array.isArray(v) && v.length && v[0].id !== undefined
            );
        ids[api] = { id: lista && lista.length ? lista[0].id : null };
      }
      return ids;
    },
    DETALLES.map((d) => d.api)
  );
}

// Espera a que no quede ninguna petición en curso durante medio segundo. Sirve también tras un
// clic en una pestaña (waitForLoadState("networkidle") no espera lo que se pide sin navegar).
async function esperarQueCargue(pagina) {
  const limite = Date.now() + ESPERA_MAXIMA_MS;
  let quietaDesde = null;
  while (Date.now() < limite) {
    if (peticionesEnCurso > 0) quietaDesde = null;
    else if (quietaDesde === null) quietaDesde = Date.now();
    else if (Date.now() - quietaDesde >= 500) return;
    await pagina.waitForTimeout(100);
  }
  problemas.push(`No terminó de cargar en ${ESPERA_MAXIMA_MS / 1000} s`);
}

async function tituloDe(pagina) {
  const titulo = pagina.locator("#contenido h1, #contenido h2").first();
  const texto = await titulo.textContent({ timeout: 2000 }).catch(() => null);
  return texto ? texto.trim().replace(/\s+/g, " ") : null;
}

async function anotar(pagina, nombre, titulo, segundos) {
  if (!titulo) problemas.push("La pantalla quedó sin título: no se pintó");
  const estado = problemas.length ? "FALLA" : segundos > SEGUNDOS_LENTA ? "LENTA" : "OK";
  let captura = null;
  if (estado === "FALLA") {
    captura = path.join(
      CARPETA_CAPTURAS,
      `${resultados.length + 1}-${nombre.replace(/[^a-z0-9]+/gi, "-")}.png`
    );
    await pagina.screenshot({ path: captura, fullPage: true }).catch(() => (captura = null));
  }
  resultados.push({
    estado,
    nombre,
    titulo,
    segundos,
    problemas: [...new Set(problemas)],
    captura,
  });
  const linea = `${estado.padEnd(6)} ${nombre.padEnd(34)} ${(titulo || "").slice(0, 38).padEnd(38)} ${segundos.toFixed(1)} s`;
  console.log(linea);
  [...new Set(problemas)].forEach((p) => console.log(`         · ${p}`));
}

// Cada pantalla se abre con una carga completa, para que un error no se le atribuya a la siguiente.
async function revisarPantalla(pagina, base, ruta) {
  saliendo = true;
  await pagina.goto("about:blank");
  saliendo = false;
  peticionesEnCurso = 0;
  problemas = [];
  const inicio = Date.now();
  await pagina
    .goto(`${base}/inicio#/${ruta}`, { timeout: ESPERA_MAXIMA_MS })
    .catch((error) => problemas.push(`No abrió: ${error.message.split("\n")[0]}`));
  await esperarQueCargue(pagina);
  const segundos = (Date.now() - inicio) / 1000;
  await anotar(pagina, `#/${ruta}`, await tituloDe(pagina), segundos);
}

// Pestañas de la ficha (role="tab"): se pasa por cada una sin recargar.
async function revisarPestanas(pagina, ruta) {
  const pestanas = pagina.locator('#contenido [role="tab"]');
  const total = await pestanas.count();
  for (let i = 0; i < total; i++) {
    problemas = [];
    const nombre = (await pestanas.nth(i).textContent()).trim();
    const inicio = Date.now();
    await pestanas.nth(i).click();
    await esperarQueCargue(pagina);
    const segundos = (Date.now() - inicio) / 1000;
    await anotar(pagina, `#/${ruta} › ${nombre}`, await tituloDe(pagina), segundos);
  }
}

function imprimirResumen(base) {
  const cuenta = (estado) => resultados.filter((r) => r.estado === estado).length;
  const fallas = cuenta("FALLA");
  console.log(
    `\nResumen de ${base}: ${resultados.length} pantallas · ${cuenta("OK")} OK · ` +
      `${cuenta("LENTA")} lentas (más de ${SEGUNDOS_LENTA} s) · ${fallas} con falla`
  );
  if (fallas) console.log(`Capturas de las fallas en ${CARPETA_CAPTURAS}`);
  return fallas;
}

async function main() {
  const datos = leerArgumentos();
  console.log(
    `Revisión de solo lectura de ${datos.base} — ${new Date().toLocaleString("es-CO")}\n`
  );
  await revisarServidor(datos.base);

  fs.rmSync(CARPETA_CAPTURAS, { recursive: true, force: true });
  fs.mkdirSync(CARPETA_CAPTURAS, { recursive: true });

  const navegador = await chromium.launch();
  let fallas = 0;
  try {
    const contexto = await navegador.newContext({ viewport: { width: 1366, height: 900 } });
    // La ventana "Actividades pendientes" no se abre sola: taparía las pantallas. En about:blank
    // (entre pantalla y pantalla) no hay localStorage, por eso solo se guarda en el sitio.
    await contexto.addInitScript(() => {
      if (location.protocol.startsWith("http")) {
        localStorage.setItem("actividades-pendientes-auto", "0");
      }
    });
    await protegerSoloLectura(contexto);
    const pagina = await contexto.newPage();
    observar(pagina);

    await iniciarSesion(pagina, datos);
    const ids = await buscarPrimerosIds(pagina);

    for (const ruta of [...PANTALLAS, ...FORMULARIOS_NUEVOS])
      await revisarPantalla(pagina, datos.base, ruta);

    for (const detalle of DETALLES) {
      const { id, error } = ids[detalle.api];
      if (error) {
        problemas = [`Servidor: ${error} en GET ${detalle.api}`];
        await anotar(pagina, `#/${detalle.ruta("?")}`, "(no se pudo buscar el primer registro)", 0);
        continue;
      }
      if (!id) {
        console.log(`—      #/${detalle.ruta("?")}: la lista está vacía, se omite`);
        continue;
      }
      await revisarPantalla(pagina, datos.base, detalle.ruta(id));
      if (detalle.conPestanas) await revisarPestanas(pagina, detalle.ruta(id));
    }
    fallas = imprimirResumen(datos.base);
  } finally {
    await navegador.close();
  }
  process.exitCode = fallas ? 1 : 0;
}

main().catch((error) => {
  console.error("\nLa revisión se detuvo por un error inesperado:", error.message);
  process.exitCode = 1;
});
