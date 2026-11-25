# Revisión automática de un sitio publicado

Después de redesplegar en hPanel, este recorrido confirma que el sitio quedó sano. Inicia sesión,
abre cada pantalla en un navegador sin ventana y avisa si alguna da error. Tarda alrededor de un
minuto.

```
npm run revisar:staging
```

Para otro sitio, pasa la dirección: `node scripts/revisar-sitio.js https://erp.soluctiasas.com`.

## Es de solo lectura

No crea, cambia ni borra nada. El script bloquea dentro del navegador toda petición que no sea de
lectura, antes de que llegue al servidor, y la reporta como falla ("Intentó escribir"). La única
excepción es el inicio de sesión, que se intenta **una sola vez**: así una contraseña equivocada no
bloquea la cuenta. Iniciar sesión solo pone en cero el contador de intentos fallidos de la cuenta,
igual que cuando entra una persona.

Por eso es lo único automático que corre contra `staging`. Las pruebas de punta a punta
(`tests/e2e/`) crean datos y siguen corriendo solo en local y en el CI.

## Credenciales

Usa la cuenta del responsable del ERP. La cuenta necesita rol admin o el cargo Gerente General
para ver todo, incluidas Auditoría y Copias. El correo y la contraseña van en un archivo de tu
equipo, fuera del repositorio y fuera de OneDrive:

1. En PowerShell: `notepad $HOME\.erp-revision.env` (Notepad pregunta si lo crea: sí).
2. Escribe estas dos líneas y guarda:

   ```
   REVISION_CORREO=tu-correo
   REVISION_PASSWORD=tu-contraseña
   ```

Si cambias la contraseña en el ERP, cámbiala también en este archivo. El script nunca imprime
estos valores. Variables de entorno con el mismo nombre reemplazan al archivo, y
`REVISION_ARCHIVO` cambia su ruta.

## Qué revisa

1. Que el servidor y la base respondan (`/health`, `/health/db`).
2. Las pantallas principales: inicio, tareas, los tableros y resúmenes, las 12 listas, Copias y
   Auditoría.
3. Los formularios de creación de cada módulo. Solo los abre, nunca los guarda.
4. El primer registro de cada lista, y las 5 pestañas de la ficha del proyecto.

Una pantalla **FALLA** si pasa algo de esto:

- da un error de JavaScript o un error en la consola;
- el servidor responde con error (400 o más);
- intenta escribir;
- no aparece su título.

Las que fallan dejan una captura en `test-results/revision/`. **LENTA** significa que tardó más de
5 segundos; es un aviso, no una falla. Si una lista está vacía, su primer registro se omite.

## Qué no revisa

- Guardar, aprobar o borrar: eso lo prueban las pruebas de punta a punta, en local.
- Subir evidencias a Google Drive ni hacer copias de seguridad.
- El criterio humano: si una pantalla se entiende o si el flujo tiene sentido para SPEAL.
