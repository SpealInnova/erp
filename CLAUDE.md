# CLAUDE.md — SPEAL Project Control (ERP)

Contexto obligatorio para cualquier agente (Claude Code u otro) que trabaje en este repositorio.

## Qué es esto

ERP interno para SPEAL S.A.S. Monolito modular: Node.js + Express + MySQL. Reemplaza formatos
Excel/Word dispersos (ver diccionario de datos en el repo de documentación, fuera de este repo).

## Arquitectura (no negociable)

- Capas: rutas → controlador → servicio → repositorio. Solo la capa de servicio escribe en BD.
- Wrapper de auditoría genérico en cada escritura (quién, cuándo, qué cambió).
- Soft-delete + `created_by`/`updated_by` en toda tabla de negocio.
- Flujos de aprobación como máquina de estados explícita.
  Ejemplo de referencia: `src/dominio/estadoProyecto.js`.
- Validación de entrada con Zod en cada endpoint. Nunca confiar en el frontend.
- "Hoy" es el día de Colombia, no el del servidor (staging y producción corren en UTC). En SQL se
  usa `HOY_COLOMBIA_SQL` y en JavaScript `hoyEnColombia()`, los dos de
  `src/dominio/fechaColombia.js`. Nunca `CURDATE()` ni `new Date()` para saber qué día es.

## Pruebas (no negociable)

- Unitarias: lógica pura (servicios, máquinas de estado). Meta: 80%+ cobertura en la capa de
  servicios.
- Integración: endpoints contra una BD de prueba real (no mocks), verificando también que
  auditoría y permisos quedaron escritos.
- E2E (Playwright, `tests/e2e/`): flujos críticos completos. Corren contra un servidor local +
  BD de prueba (Docker), no contra `staging` real — esa BD está conectada a la cuenta real de
  soluctiasas.com y no se usa para generar datos de prueba. Wireados en CI tras los tests de Jest.
- Revisión de sitio (`npm run revisar:staging`, `scripts/revisar-sitio.js`,
  `docs/REVISION_DE_SITIO.md`): es lo único que corre contra `staging`, porque es de solo lectura.
  Bloquea en el navegador toda petición que no sea GET y la reporta como falla. Se corre después de
  cada redespliegue. Las credenciales están en `~/.erp-revision.env`, en el equipo del usuario; un
  agente nunca abre ni repite ese archivo.
- CI (`.github/workflows/ci.yml`) corre lint + test en cada push/PR a `develop`/`staging`/`main`.
  Un PR no se aprueba si CI falla. Sin excepciones.

## Ramas = entornos

- `develop` → sin sitio publicado. erp-dev.soluctiasas.com y su BD se eliminaron el 2026-11-13
  para liberar espacio en la cuenta de soluctiasas.com (también aloja producción). Se prueba en
  local (Docker + Jest + Playwright) y en CI; la revisión visual se hace en `staging`.
- `staging` → erp-test.speal-pad.com (pruebas — app en la cuenta de Hostinger de speal-pad.com,
  BD sigue en la cuenta de soluctiasas.com, conexión remota con la IP del sitio en la whitelist
  de Remote MySQL)
- `main` → erp.soluctiasas.com (producción)

Flujo: crear rama `feature/<nombre>` desde `develop`, PR a `develop`. Promoción entre entornos es
`develop` → `staging` → `main`, nunca directo a `main`.

## Estilo

- ESLint + Prettier. Antes de cualquier commit: `npm run lint` y `npm test` deben pasar en local.
- Conventional Commits: `feat:`, `fix:`, `test:`, `refactor:`, `chore:`.

## Seguridad

- Nunca comitear `.env` ni secretos. `.env.example` solo con claves, sin valores reales.
- Toda consulta parametrizada, nunca concatenar SQL.
- Validar permisos en el servidor, no solo ocultar botones en el frontend.

## Google: correo, evidencias y copias de seguridad

- Correo, evidencias/adjuntos (`src/servicios/archivosDrive.js`) y copias de seguridad
  (`src/servicios/copiasSeguridad.js`, `docs/COPIAS_DE_SEGURIDAD.md`) usan el mismo
  `GMAIL_REFRESH_TOKEN`. Desde el 2026-11-23 ese token tiene los scopes `gmail.send` y
  `drive.file` en `staging` y en `main`.
- Con `drive.file`, la aplicación solo escribe en las carpetas que ella misma creó. Esas carpetas
  están en el Drive de innova@speal-intl.com, dentro de "SPEAL ERP":
  - "Evidencias - producción": `DRIVE_FOLDER_ID` de `main`.
  - "Evidencias - pruebas": `DRIVE_FOLDER_ID` de `staging`.
  - "Copias de seguridad": `DRIVE_COPIAS_FOLDER_ID` de ambos.
- Para regenerar el token, el usuario corre `scripts/autorizar-gmail.js` en su equipo y pega el
  token directo en hPanel. El script usa el redirect `http://localhost:53682/callback`, que ya
  está registrado en el cliente OAuth. Un agente nunca debe ver, guardar ni repetir ese token.
- Las pruebas nunca suben a Drive real (usan Drive simulado).

- Copia diaria automática: activa en producción desde el 2026-11-24 (`COPIAS_DIARIAS=1`,
  `COPIAS_HORA=3`, hora de Colombia). En `staging` solo se usa la copia manual.

## Front-end (`src/public/`)

- `inicio.html` carga primero los módulos en IIFE que exponen `window.*` (`tableros.js`,
  `tablerosOperacion.js`, `gantt.js`, `fichaProyecto.js`, `tareas.js`, `auditoria.js`…). Después
  carga la aplicación, dividida en scripts clásicos que comparten sus nombres globales y van en
  este orden: `nucleo.js` (api, perfil, piezas de interfaz, menú), `formulariosComunes.js`,
  `clientes.js`, `proyectosComun.js`, `documentos.js`, `proyectos.js`, `cotizaciones.js`,
  `proveedores.js`, `requisiciones.js`, `ordenesCompra.js`, `expedientes.js`, `soporte.js`,
  `actas.js`, `usuarios.js` e `inicio.js` (enrutador y arranque, siempre al final).
- Cada script lleva `/* global */` (lo que usa de otros) y `/* exported */` (lo que otros usan
  de él); ESLint los exige.
- El código que corre al cargar un script (fuera de funciones) no puede usar nombres de un
  script que carga después: da ReferenceError. Si hace falta, se envuelve en una función o se
  espera a `DOMContentLoaded`.
- Las pestañas de un módulo (`SECCIONES_POR_MODULO` en `nucleo.js`) pueden pedir un `permiso`.
- Permisos que solo tienen el rol admin y el Gerente General: `gestionar_copias` y
  `ver_auditoria` (pantalla `#/auditoria`, `GET /auditoria`).
- Actividades del proyecto: `origen` es `plantilla` (catálogo de la fase) o `manual`
  (subactividad). Las manuales no impiden sembrar la plantilla de su fase y se listan al final.

## Pendientes conocidos (no asumir que ya existen)

- Catálogos cerrados (productos, clientes, proveedores) aún no entregados por el usuario.
- El diccionario de datos vive en `documentacion/DICCIONARIO_DE_DATOS.txt`, en el repo de
  documentación del proyecto (no en este repo de código).
- Mejoras visuales: el usuario las pedirá después del rediseño de 2026-11-24.

## Qué puede resolver un agente sin supervisión directa

- CRUD de una entidad que ya esté definida en el diccionario de datos, con sus pruebas.
- Migraciones de esquema ya aprobadas/documentadas.
- Componentes de frontend que sigan el prototipo ya existente (`PropuestaWeb.html`).
- Refactors acotados a un solo módulo, con pruebas verdes antes y después del cambio.

## Qué requiere revisión humana antes de aplicarse

- Cualquier cambio de arquitectura o de esquema que no esté ya en el diccionario de datos.
- Merge a `staging` o `main`.
- Manejo de credenciales o variables de entorno.
- Cualquier decisión de negocio ambigua (p. ej. el caso del Acta de Entrega con Comercial).
