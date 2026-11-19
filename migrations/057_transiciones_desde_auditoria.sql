-- Llena transiciones_estado con el historial que ya existe en la auditoría:
-- creación y cambios de fase de cada proyecto, y cambios de estado de sus
-- actividades. Así los proyectos anteriores también tienen días por fase.
-- Reintentable: no repite una transición ya copiada (mismo registro y hora).
INSERT INTO transiciones_estado
  (entidad, registro_id, proyecto_id, estado_anterior, estado_nuevo, usuario_id, created_at)
SELECT
  CASE WHEN a.tabla = 'proyectos' THEN 'proyecto' ELSE 'actividad' END,
  a.registro_id,
  CASE WHEN a.tabla = 'proyectos' THEN a.registro_id
       ELSE JSON_VALUE(a.datos_nuevos, '$.proyecto_id') END,
  CASE WHEN a.accion = 'crear' THEN NULL ELSE JSON_VALUE(a.datos_anteriores, '$.estado') END,
  JSON_VALUE(a.datos_nuevos, '$.estado'),
  a.usuario_id,
  a.creado_en
FROM auditoria a
WHERE ((a.tabla = 'proyectos' AND a.accion = 'crear')
    OR (a.tabla IN ('proyectos', 'proyecto_actividades') AND a.accion = 'actualizar'
        AND JSON_VALUE(a.datos_anteriores, '$.estado') <> JSON_VALUE(a.datos_nuevos, '$.estado')))
  AND JSON_VALUE(a.datos_nuevos, '$.estado') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM transiciones_estado t
     WHERE t.entidad = CASE WHEN a.tabla = 'proyectos' THEN 'proyecto' ELSE 'actividad' END
       AND t.registro_id = a.registro_id
       AND t.created_at = a.creado_en
  );
