# Copias de seguridad del ERP

Cada copia guarda el estado completo del ERP: la estructura y los datos de todas las tablas de la
base. Se guarda como un archivo `.sql.gz` en Google Drive. Las evidencias y los adjuntos ya están
en Drive, así que no se copian de nuevo.

Cada intento queda registrado en la tabla `copias_seguridad`, con su fecha, resultado, tamaño y
archivo en Drive. El panel **Control → Copias de seguridad** muestra ese registro y el botón
**Hacer copia ahora**. Solo pueden usarlo el rol `admin` y el Gerente General. El servidor también
lo valida (permiso `gestionar_copias`).

## Configuración (variables de entorno en hPanel)

| Variable | Valor |
|---|---|
| `COPIAS_DIARIAS` | `1` solo en producción. Activa la copia automática diaria. |
| `COPIAS_HORA` | Hora desde la que se hace la copia del día, de 0 a 23. Por defecto es 2. |
| `DRIVE_COPIAS_FOLDER_ID` | ID de la carpeta de copias en el Drive de innova@speal-intl.com. Si está vacía, se usa `DRIVE_FOLDER_ID`. |

Las copias usan el mismo token de Google que el correo y las evidencias (`GMAIL_REFRESH_TOKEN`).
Ese token necesita el permiso de Drive `drive.file`. Para regenerarlo:

1. Corre `scripts/autorizar-gmail.js` en tu equipo.
2. Pega el token directo en hPanel.

Nadie más debe ver ni guardar ese token.

Con el permiso `drive.file`, la aplicación solo puede escribir en las carpetas que ella misma creó
o que se le abrieron. Si la subida falla con "File not found" en la carpeta, crea la carpeta de
copias desde la aplicación o usa la misma carpeta que ya funciona para las evidencias.

## Cómo funciona

- **Copia automática:** el servidor revisa cada hora. A partir de `COPIAS_HORA`, si hoy no hay una
  copia exitosa, hace una.
  - Si falla, lo reintenta en la siguiente revisión, hasta 3 veces al día.
- **Sin cruces:** solo se hace una copia a la vez. Staging y producción comparten el servidor
  MySQL, por eso el bloqueo es por base de datos.
- **Copias interrumpidas:** una copia que quede a medias, por ejemplo por un reinicio, aparece
  como fallida después de una hora.
- **Errores:** si Drive no está configurado o rechaza el archivo, la copia queda como **fallida**
  con el motivo, y el ERP sigue funcionando.
- **Retención:** no se borran copias antiguas automáticamente. Si el espacio de Drive lo exige,
  bórralas a mano desde Drive.

## Restaurar una copia

Restaurar reemplaza los datos. Hazlo solo con la aprobación de quien administra el servidor y con
la aplicación detenida.

1. Descarga el archivo `copia-erp-<base>-<fecha>.sql.gz` desde Drive y descomprímelo para obtener
   el `.sql`.
2. En hPanel → Bases de datos → phpMyAdmin, elige una base **vacía** (o crea una nueva) y usa
   **Importar** con ese `.sql`.
   - El archivo trae `DROP TABLE IF EXISTS` y `CREATE TABLE` de cada tabla, y sus datos en
     `INSERT`.
3. Apunta la aplicación a esa base (`DB_NAME`) y reiníciala.
4. Verifica `/health/db` y el inicio de sesión.

La copia contiene datos personales y los hashes de las contraseñas. La carpeta de Drive debe
compartirse solo con quien administra el ERP.
