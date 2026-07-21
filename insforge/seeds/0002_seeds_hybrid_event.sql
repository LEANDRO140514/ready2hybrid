-- =====================================================================
-- 0002_seeds_hybrid_experience.sql
-- Catálogo oficial · HYBRID EXPERIENCE 2026
-- Mérida, Yucatán · 9, 10 y 11 de octubre de 2026
-- Fuente: TICKETS.xlsx + confirmaciones de dirección (19 jul 2026)
--
-- REGLAS DEL CATÁLOGO:
--  · Precios en centavos MXN. TODOS los precios YA INCLUYEN seguro y chip.
--    No hay cargos extra en el checkout: el precio mostrado es el cobrado.
--  · price_cents es POR UNIDAD DE VENTA (equipo completo, no por persona).
--  · Excepción WORKOUT: sin chip ni seguro (es clase, no competencia),
--    pero SÍ lleva registro completo y ticket QR.
--  · Cupos: provisionales, editables desde el panel.
-- =====================================================================

-- ── EVENTO ──
INSERT INTO events (code, name, venue_city, timezone, starts_on, ends_on, status)
VALUES ('HEX-2026', 'Hybrid Experience 2026', 'Mérida, Yucatán',
        'America/Merida', '2026-10-09', '2026-10-11', 'CONFIGURADO');

INSERT INTO event_days (event_code, day_date, label) VALUES
('HEX-2026','2026-10-09','Viernes 9 — Dobles (PM)'),
('HEX-2026','2026-10-10','Sábado 10 — ½ Hybrid y Workout (AM) · Relay (PM)'),
('HEX-2026','2026-10-11','Domingo 11 — Individual (AM)');

-- =====================================================================
-- BLOQUE 1 · COMPITE — competencia oficial
-- =====================================================================
INSERT INTO products
(event_code, code, name, block, kind, team_size, price_cents, cupo, day, session, has_chip, has_insurance) VALUES

-- DOBLES viernes PM · $2,400 por pareja
('HEX-2026','DOB-VIE-MM','Dobles Mujeres · Viernes','COMPITE','competitor',2,240000,40,'2026-10-09','PM',true,true),
('HEX-2026','DOB-VIE-HH','Dobles Hombres · Viernes','COMPITE','competitor',2,240000,40,'2026-10-09','PM',true,true),
('HEX-2026','DOB-VIE-MH','Dobles Mixto · Viernes','COMPITE','competitor',2,240000,40,'2026-10-09','PM',true,true),

-- DOBLES sábado AM · $2,400 por pareja
('HEX-2026','DOB-SAB-MM','Dobles Mujeres · Sábado','COMPITE','competitor',2,240000,40,'2026-10-10','AM',true,true),
('HEX-2026','DOB-SAB-HH','Dobles Hombres · Sábado','COMPITE','competitor',2,240000,40,'2026-10-10','AM',true,true),
('HEX-2026','DOB-SAB-MH','Dobles Mixto · Sábado','COMPITE','competitor',2,240000,40,'2026-10-10','AM',true,true),

-- RELAY sábado PM · $3,200 por equipo de 4
('HEX-2026','REL-4H','Relay 4 Hombres','COMPITE','competitor',4,320000,20,'2026-10-10','PM',true,true),
('HEX-2026','REL-4M','Relay 4 Mujeres','COMPITE','competitor',4,320000,20,'2026-10-10','PM',true,true),
('HEX-2026','REL-2H2M','Relay Mixto (2H+2M)','COMPITE','competitor',4,320000,20,'2026-10-10','PM',true,true),

-- INDIVIDUAL domingo AM · $1,400 por persona (mismo precio Open y Pro)
('HEX-2026','IND-H','Individual Hombre (Open)','COMPITE','competitor',1,140000,60,'2026-10-11','AM',true,true),
('HEX-2026','IND-M','Individual Mujer (Open)','COMPITE','competitor',1,140000,60,'2026-10-11','AM',true,true),
('HEX-2026','IND-PRO-H','Individual Pro Hombre','COMPITE','competitor',1,140000,30,'2026-10-11','AM',true,true),
('HEX-2026','IND-PRO-M','Individual Pro Mujer','COMPITE','competitor',1,140000,30,'2026-10-11','AM',true,true);

-- =====================================================================
-- BLOQUE 2 · EXPERIENCE — puerta de entrada al deporte híbrido
-- =====================================================================
INSERT INTO products
(event_code, code, name, block, kind, team_size, price_cents, cupo, day, session, has_chip, has_insurance) VALUES

-- ½ HYBRID · Formato by ENFORMA · sábado AM · $800 POR PERSONA
-- (individual $800 · dobles $1,600 = $800 c/u — precio por persona constante)
('HEX-2026','HALF-IND-M','½ Hybrid Individual Mujer','EXPERIENCE','competitor',1, 80000,50,'2026-10-10','AM',true,true),
('HEX-2026','HALF-IND-H','½ Hybrid Individual Hombre','EXPERIENCE','competitor',1, 80000,50,'2026-10-10','AM',true,true),
('HEX-2026','HALF-DOB-MM','½ Hybrid Dobles Mujeres','EXPERIENCE','competitor',2,160000,30,'2026-10-10','AM',true,true),
('HEX-2026','HALF-DOB-HH','½ Hybrid Dobles Hombres','EXPERIENCE','competitor',2,160000,30,'2026-10-10','AM',true,true),
('HEX-2026','HALF-DOB-MH','½ Hybrid Dobles Mixto','EXPERIENCE','competitor',2,160000,30,'2026-10-10','AM',true,true),

-- WORKOUT · clase de 1 hora en instalaciones reales · sábado AM · $300
-- SIN chip ni seguro, PERO con registro completo y ticket QR
('HEX-2026','WOD-M','Workout Experience Mujer','EXPERIENCE','workout',1, 30000,60,'2026-10-10','AM',false,false),
('HEX-2026','WOD-H','Workout Experience Hombre','EXPERIENCE','workout',1, 30000,60,'2026-10-10','AM',false,false);

-- =====================================================================
-- BLOQUE 3 · ASISTE — público y prensa
-- =====================================================================
INSERT INTO products
(event_code, code, name, block, kind, team_size, price_cents, cupo, day, session, has_chip, has_insurance) VALUES

('HEX-2026','PUB-VIE','Público · Viernes 9','ASISTE','spectator',1, 25000,500,'2026-10-09',NULL,false,false),
('HEX-2026','PUB-SAB','Público · Sábado 10','ASISTE','spectator',1, 25000,500,'2026-10-10',NULL,false,false),
('HEX-2026','PUB-DOM','Público · Domingo 11','ASISTE','spectator',1, 25000,500,'2026-10-11',NULL,false,false),
('HEX-2026','PUB-3D','Público · Pase 3 Días','ASISTE','spectator',1, 60000,300,NULL,NULL,false,false),

('HEX-2026','FOT-VIE','Fotógrafo · Viernes 9','ASISTE','press',1, 35000, 30,'2026-10-09',NULL,false,false),
('HEX-2026','FOT-SAB','Fotógrafo · Sábado 10','ASISTE','press',1, 35000, 30,'2026-10-10',NULL,false,false),
('HEX-2026','FOT-DOM','Fotógrafo · Domingo 11','ASISTE','press',1, 35000, 30,'2026-10-11',NULL,false,false),
('HEX-2026','FOT-3D','Fotógrafo · Pase 3 Días','ASISTE','press',1, 80000, 20,NULL,NULL,false,false);

-- =====================================================================
-- RESUMEN: 29 productos
--   COMPITE 13 · EXPERIENCE 7 · ASISTE 9
-- Notas operativas:
--   · kind='workout'  → check-in sí, kit sin chip, sin carta de competencia
--   · kind='press'    → acreditación de fotógrafo (gafete, no chip)
--   · pase 3 días (day NULL) → el check-in valida los 3 días
-- =====================================================================
