-- Pre-chequeo del paso a producción (SOLO LECTURA: únicamente SELECT).
-- Se ejecuta en phpMyAdmin sobre la base de producción ANTES de desplegar
-- (ver docs/PASO_A_PRODUCCION.md). No modifica nada.

-- 1) Debe dar 0 filas. Reportes sin proyecto que la migración 044 no puede
--    completar: la 045 (proyecto obligatorio) fallaría y la app no arrancaría.
--    Si aparecen, asígnales su proyecto antes de desplegar.
SELECT r.id, r.numero_reporte, r.equipo_numero_serie, r.cliente_id
FROM reportes_servicio_tecnico r
LEFT JOIN expedientes_diseno e ON e.numero_serie = r.equipo_numero_serie
WHERE r.proyecto_id IS NULL AND e.id IS NULL;

-- 2) Debe dar 0 filas. Reportes con serial vacío: no pasan al registro de
--    equipos y la llave de la migración 043 fallaría.
SELECT id, numero_reporte FROM reportes_servicio_tecnico WHERE equipo_numero_serie = '';

-- 3) Usuarios activos con su rol y cargo. De aquí salen los permisos: revisa
--    que cada aprobador tenga el cargo exacto del catálogo (Director
--    Administrativo y Financiero, Gerente Comercial, Jefe de I+D+i, etc.) y
--    quién tiene rol "admin".
SELECT id, nombre, correo, rol, cargo
FROM usuarios
WHERE deleted_at IS NULL AND activo = 1
ORDER BY cargo, nombre;
