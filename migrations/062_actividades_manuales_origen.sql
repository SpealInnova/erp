-- Las actividades agregadas a mano hasta hoy tienen orden 0 (las de plantilla
-- van de 1 en adelante, ver dominio/actividadesCatalogoProyecto.js).
-- Reintentable: solo marca las que siguen como plantilla con orden 0.
UPDATE proyecto_actividades SET origen = 'manual' WHERE orden = 0 AND origen = 'plantilla';
