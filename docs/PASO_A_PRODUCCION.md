# Paso a producción: `staging` → `main` (erp.soluctiasas.com)

Guía para llevar a producción lo que hoy está en `staging`
(erp-test.speal-pad.com). Se sigue en orden. **El merge a `main` necesita la
aprobación explícita del responsable del proyecto** (CLAUDE.md: "Merge a
`staging` o `main`" requiere revisión humana).

## Qué sube

`main` está en la migración 036 (última actualización: 2026-11-10). Sube:

- **Proyectos:** Gantt por fase, eliminación con contraseña y justificación,
  sección "Documentos del proyecto" y línea de tiempo con los documentos de
  otros módulos.
- **Tableros:** gerencial, Comercial y Compras, y menú agrupado por módulos.
- **Conexión entre módulos:** reportes y actas validan proyecto, cliente y
  equipo; registro de equipos, incluidos los anteriores al ERP. Todo
  reporte de servicio tiene proyecto.
- **Versiones:** los documentos con enlaces no se eliminan, se corrigen con
  una nueva versión que guarda el historial.
- **Permisos por cargo:** aprobar OC y cotizaciones, liberar diseño,
  cancelar proyectos y crear versiones. Quien crea una OC o un cambio de
  diseño no lo aprueba.
- **Listas con búsqueda, filtro por estado y paginador.**
- **Usuarios:** edición de usuarios y catálogo de cargos.

**16 migraciones nuevas (037–052).** Corren solas al arrancar la app. Si una
falla, la app no arranca (`process.exit(1)`) y el sitio queda caído hasta
corregirla. Por eso hay pre-chequeo, respaldo y ensayo antes de desplegar.

| Migraciones | Qué hacen                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| 037–038     | Fechas de las actividades del Gantt                                                                      |
| 039         | Normaliza un texto de cargo                                                                              |
| 040–041     | Crean el registro de equipos y lo llenan con los expedientes que tienen serial, incluidos los eliminados |
| 042–043     | El reporte de servicio pasa a apuntar al registro de equipos                                             |
| 044–045     | Los reportes sin proyecto toman el de su equipo y el proyecto se vuelve obligatorio                      |
| 046–052     | Historial de versiones y columna `version` en seis tablas                                                |

Las migraciones 037, 038, 042 y 043 se pueden reintentar sin error, y las
demás ya lo eran. Así, si el arranque se interrumpe a mitad de una
migración, el siguiente arranque no queda bloqueado.

## 1. Validar `staging` (equipo SPEAL)

En erp-test.speal-pad.com, con usuarios de cargos distintos:

- [ ] **Tablero gerencial:** abre sin errores. Con un cargo aprobador
      aparece "Aprobar"; con otro cargo aparece "Revisar".
- [ ] **Compras:** quien no aprueba ve la nota de quién decide, en lugar del
      selector de estado. Quien creó la OC tampoco puede aprobarla.
- [ ] **Proyectos:** buscar por nombre o cliente, filtrar por fase y
      paginar. En la ficha, revisar "Documentos del proyecto", la línea de
      tiempo y el panel de versiones.
- [ ] **Soporte técnico:** registrar un equipo histórico y hacerle un
      reporte. El reporte queda en un proyecto del mismo cliente.
- [ ] **Entregas:** crear un acta de entrega y su acta de cierre.
- [ ] **Versiones:** crear una nueva versión de un documento con motivo. La
      anterior queda en el historial con vista previa.

## 2. Pre-chequeo en producción (solo lectura)

En hPanel → Bases de datos → phpMyAdmin de la base de producción, ejecutar
[`docs/prechequeo-produccion.sql`](prechequeo-produccion.sql). Solo tiene
`SELECT`.

- [ ] **Consultas 1 y 2: 0 filas.** Si aparecen filas, corregir esos
      reportes (asignarles proyecto o serial) antes de seguir.
- [ ] **Consulta 3: revisar los cargos.** Cada aprobador debe tener su cargo
      exacto del catálogo, porque de él dependen sus permisos: - Director Administrativo y Financiero - Contador General - Gerente Comercial - Jefe de I+D+i - Director de Operaciones y Producción - Jefe de Proyectos - etc.

  El rol `admin` y el cargo Gerente General tienen todos los permisos. Sin el
  cargo correcto, después del despliegue esa persona no verá sus botones de
  aprobación. Se corrige editando el usuario en la pantalla Usuarios, que
  marca "Fuera del catálogo".

## 3. Respaldo de la base de producción

- [ ] En hPanel → phpMyAdmin → la base de producción → **Exportar →
      Rápido → SQL**. Opcional: también una copia de seguridad desde hPanel.
- [ ] Anotar la fecha y hora del respaldo.
- [ ] Guardar el archivo en un lugar seguro: **nunca en el repositorio**.
      Contiene datos reales.

## 4. Ensayo local con el respaldo

Con Docker y el contenedor de pruebas `erp-test-db` encendido:

```bash
docker exec -i erp-test-db mariadb -uroot -proot -e "CREATE DATABASE erp_prod_ensayo"
docker exec -i erp-test-db mariadb -uroot -proot erp_prod_ensayo < respaldo.sql
# desde la rama staging:
node scripts/ensayo-migraciones.js erp_prod_ensayo
```

El script hace tres cosas:

1. Repite el pre-chequeo. Si hay datos que harían fallar las migraciones, se
   detiene.
2. Aplica las migraciones con el mismo migrador de la app.
3. Muestra comprobaciones: reportes sin proyecto = 0 y reportes sin equipo
   en el registro = 0.

Solo acepta una base local.

- [ ] El ensayo termina sin errores.
- [ ] Opcional: levantar la app contra `erp_prod_ensayo` y recorrer las
      pantallas con datos reales.
- [ ] Al terminar, borrar la base de ensayo y el archivo del respaldo local:

      docker exec -i erp-test-db mariadb -uroot -proot -e "DROP DATABASE erp_prod_ensayo"

## 5. Merge a `main` (con aprobación)

- [ ] CI en verde en `staging` para el commit que se va a subir.
- [ ] Aprobación explícita del responsable.
- [ ] `git checkout main && git merge --no-ff origin/staging && git push origin main`
- [ ] CI en verde en `main`.

## 6. Despliegue y verificación

El despliegue automático de Hostinger ha fallado antes. Hacer el redeploy
manual:

- [ ] hPanel → sitio erp.soluctiasas.com → Node.js → redesplegar la rama
      `main`.
- [ ] Comprobar:

  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" https://erp.soluctiasas.com/health      # 200
  curl -s -o /dev/null -w "%{http_code}\n" https://erp.soluctiasas.com/health/db   # 200
  curl -s -o /dev/null -w "%{http_code}\n" https://erp.soluctiasas.com/equipos     # 401 (la ruta existe: migró y arrancó)
  curl -sI https://erp.soluctiasas.com/js/inicio.js | grep -i last-modified       # fecha del despliegue
  ```

- [ ] Iniciar sesión con un usuario de cada cargo aprobador y aprobar una OC
      de prueba, o revisar que aparece el botón.

**Problema conocido, independiente de este paso:** en `staging` y `main`, el
`GMAIL_REFRESH_TOKEN` no tiene el alcance `drive.file`. Subir evidencias
responde 500 hasta regenerar el token y configurar `DRIVE_FOLDER_ID`.

## 7. Reversión

Se revierte si:

- `/health` no responde 200 después del redeploy (la app no arrancó);
- falla una migración;
- algo crítico no funciona, por ejemplo no se puede iniciar sesión o se
  pierden datos.

Pasos:

1. **Código:** `git revert -m 1 <commit del merge>` en `main`, push y
   redeploy manual.
2. **Base de datos:** si alguna migración alcanzó a correr, el código viejo
   puede chocar con el esquema nuevo. Por ejemplo, un reporte sin proyecto
   ya no se acepta. Restaurar el respaldo del paso 3 en phpMyAdmin
   (Importar) **antes** del redeploy.
3. **Avisar al equipo:** los datos creados entre el respaldo y la
   restauración se pierden. Por eso conviene desplegar en un horario sin
   uso.
