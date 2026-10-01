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

## Pruebas (no negociable)

- Unitarias: lógica pura (servicios, máquinas de estado). Meta: 80%+ cobertura en la capa de
  servicios.
- Integración: endpoints contra una BD de prueba real (no mocks), verificando también que
  auditoría y permisos quedaron escritos.
- E2E (Playwright): flujos críticos completos, corridos en `staging` antes de pasar a producción.
- CI (`.github/workflows/ci.yml`) corre lint + test en cada push/PR a `develop`/`staging`/`main`.
  Un PR no se aprueba si CI falla. Sin excepciones.

## Ramas = entornos

- `develop` → erp-dev.soluctiasas.com (desarrollo)
- `staging` → erp-test.soluctiasas.com (pruebas)
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

## Pendientes conocidos (no asumir que ya existen)

- Catálogos cerrados (productos, clientes, proveedores) aún no entregados por el usuario.
- Formato FO-CL-008 (Acta de Entrega de Equipos) detectado pero aún no diccionado.
- El diccionario de datos vive en `documentacion/DICCIONARIO_DE_DATOS.txt`, en el repo de
  documentación del proyecto (no en este repo de código).

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
