-- Recovered from applied production migration 0004.
-- Source: InsForge production migration history.
-- Do not edit without verifying against production record.

INSERT INTO events (code, name, venue_city, timezone, starts_on, ends_on, status)
VALUES ('HEX-2026', 'Hybrid Experience 2026', 'Mérida, Yucatán',
        'America/Merida', '2026-10-09', '2026-10-11', 'CONFIGURADO');
INSERT INTO event_days (event_code, day_date, label) VALUES
('HEX-2026','2026-10-09','Viernes 9 — Dobles (PM)'),
('HEX-2026','2026-10-10','Sábado 10 — ½ Hybrid, Dobles y Workout por la mañana; Relay por la tarde.'),
('HEX-2026','2026-10-11','Domingo 11 — Individual (AM)');
INSERT INTO products
(event_code, code, name, block, kind, team_size, price_cents, cupo, day, session, has_chip, has_insurance) VALUES


('HEX-2026','DOB-VIE-MM','Dobles Mujeres · Viernes','COMPITE','competitor',2,240000,40,'2026-10-09','PM',true,true),
('HEX-2026','DOB-VIE-HH','Dobles Hombres · Viernes','COMPITE','competitor',2,240000,40,'2026-10-09','PM',true,true),
('HEX-2026','DOB-VIE-MH','Dobles Mixto · Viernes','COMPITE','competitor',2,240000,40,'2026-10-09','PM',true,true),


('HEX-2026','DOB-SAB-MM','Dobles Mujeres · Sábado','COMPITE','competitor',2,240000,40,'2026-10-10','AM',true,true),
('HEX-2026','DOB-SAB-HH','Dobles Hombres · Sábado','COMPITE','competitor',2,240000,40,'2026-10-10','AM',true,true),
('HEX-2026','DOB-SAB-MH','Dobles Mixto · Sábado','COMPITE','competitor',2,240000,40,'2026-10-10','AM',true,true),


('HEX-2026','REL-4H','Relay 4 Hombres','COMPITE','competitor',4,320000,20,'2026-10-10','PM',true,true),
('HEX-2026','REL-4M','Relay 4 Mujeres','COMPITE','competitor',4,320000,20,'2026-10-10','PM',true,true),
('HEX-2026','REL-2H2M','Relay Mixto 2H+2M','COMPITE','competitor',4,320000,20,'2026-10-10','PM',true,true),


('HEX-2026','IND-H','Individual Hombre Open','COMPITE','competitor',1,140000,60,'2026-10-11','AM',true,true),
('HEX-2026','IND-M','Individual Mujer Open','COMPITE','competitor',1,140000,60,'2026-10-11','AM',true,true),
('HEX-2026','IND-PRO-H','Individual Pro Hombre','COMPITE','competitor',1,140000,30,'2026-10-11','AM',true,true),
('HEX-2026','IND-PRO-M','Individual Pro Mujer','COMPITE','competitor',1,140000,30,'2026-10-11','AM',true,true);
INSERT INTO products
(event_code, code, name, block, kind, team_size, price_cents, cupo, day, session, has_chip, has_insurance) VALUES



('HEX-2026','HALF-IND-M','½ Hybrid Individual Mujer','EXPERIENCE','competitor',1, 80000,50,'2026-10-10','AM',true,true),
('HEX-2026','HALF-IND-H','½ Hybrid Individual Hombre','EXPERIENCE','competitor',1, 80000,50,'2026-10-10','AM',true,true),
('HEX-2026','HALF-DOB-MM','½ Hybrid Dobles Mujeres','EXPERIENCE','competitor',2,160000,30,'2026-10-10','AM',true,true),
('HEX-2026','HALF-DOB-HH','½ Hybrid Dobles Hombres','EXPERIENCE','competitor',2,160000,30,'2026-10-10','AM',true,true),
('HEX-2026','HALF-DOB-MH','½ Hybrid Dobles Mixto','EXPERIENCE','competitor',2,160000,30,'2026-10-10','AM',true,true),



('HEX-2026','WOD-M','Workout Experience Mujer','EXPERIENCE','workout',1, 30000,60,'2026-10-10','AM',false,false),
('HEX-2026','WOD-H','Workout Experience Hombre','EXPERIENCE','workout',1, 30000,60,'2026-10-10','AM',false,false);
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
