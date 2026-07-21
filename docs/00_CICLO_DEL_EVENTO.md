# Ready2Hybrid — El ciclo completo del evento

> Este es el documento rector. Todo evento de ENFORMA —hybrid, carrera o
> torneo— vive el mismo ciclo de 8 etapas dentro del sistema. Los demás
> documentos (plan técnico, journeys, revisión) son el soporte de este.

## El ciclo en una vista

```text
1. CREAR → 2. CONFIGURAR → 3. ABRIR VENTAS → 4. VENDER
                                                  ↓
8. ARCHIVAR ← 7. CERRAR ← 6. OPERAR (día D) ← 5. PREPARAR
```

El evento tiene un solo estado que gobierna todo:

```text
BORRADOR → CONFIGURADO → EN_VENTA → VENTA_CERRADA
         → EN_OPERACIÓN → EN_RESULTADOS → CERRADO → ARCHIVADO
```

Cada etapa tiene una **condición de salida**: el sistema no deja avanzar si
falta algo. Así el proceso se cuida solo.

---

## Etapa 1 — CREAR

**Quién:** dirección.
**Qué se hace:** nombre del evento, fecha, sede, tipo (hybrid / carrera /
torneo). Al elegir el tipo, el sistema activa los módulos correspondientes.
**Sale cuando:** el evento existe en estado BORRADOR.

## Etapa 2 — CONFIGURAR

**Quién:** dirección + operaciones.
**Qué se hace:**
- productos y precios (inscripciones por modalidad, accesos de asistente);
- categorías y cupos;
- waiver (texto versionado);
- métodos de pago habilitados;
- días y áreas de la sede.

**Sale cuando:** hay al menos un producto con precio, cupo y waiver.
El sistema bloquea abrir ventas si algo falta. Estado → CONFIGURADO.

## Etapa 3 — ABRIR VENTAS

**Quién:** dirección (un botón).
**Qué se hace:** la landing muestra los productos y empieza a vender.
**Qué hace el sistema solo:** publica productos, controla cupos, deja de
mostrar lo agotado.
**Sale cuando:** estado → EN_VENTA. Desde aquí el sistema trabaja solo.

## Etapa 4 — VENDER (automática)

**Quién:** nadie. Esta etapa opera sin humanos; el equipo solo supervisa.
**Qué hace el sistema solo:**
- registra competidores, parejas, equipos y asistentes;
- cobra (tarjeta al momento; efectivo cuando el cliente paga su voucher);
- confirma, asigna folio y envía ticket QR;
- libera cupos de pagos vencidos;
- arma el CRM con cada persona y su historial.

**Qué hace el equipo:** atender dudas desde el CRM y ver el tablero de
ventas. Nada de confirmar pagos ni conciliar a mano.
**Sale cuando:** llega la fecha de cierre de ventas (48 h antes del evento,
configurable). Estado → VENTA_CERRADA.

## Etapa 5 — PREPARAR

**Quién:** operaciones.
**Qué se hace (con listas que el sistema genera solo):**
- staff: turnos, áreas, acreditaciones — cada quien recibe su asignación;
- competencia: heats, carriles y horarios asignados desde los inscritos;
- kits: lista por talla y por persona;
- comunicación: correo automático a todos con su hora de llamada y su QR;
- respaldos: listas imprimibles por si todo falla.

**Sale cuando:** checklist de preparación completo (staff confirmado, heats
asignados, kits listos, ensayo de puerta sin internet realizado).

## Etapa 6 — OPERAR (día D)

**Quién:** todo el equipo, cada rol en una sola pantalla.
```text
Puerta         escanear = check-in; verde pasa, rojo va a mesa de soluciones
Mesa           resuelve casos con botones (verificar pago, reenviar QR,
               pago en sitio, waiver en sitio); todo queda auditado
Jueces         capturan tiempos y penalizaciones con toques, sin calcular
Director       una pantalla: check-ins, próximos heats, incidencias, retraso;
               puede recorrer el programa en bloque
```
**Qué hace el sistema solo:** valida accesos, detecta duplicados, crea
incidencias, funciona igual sin internet y sincroniza al volver la red.
Ready2Hybrid opera como PWA offline-first: puede registrar operaciones de
forma temporal sin conexión, pero **InsForge conserva la autoridad final**
sobre tickets, QR, check-ins, resultados y auditoría. Al sincronizar,
InsForge resuelve duplicados, revocaciones y conflictos entre dispositivos.
**Sale cuando:** termina el último heat. Estado → EN_RESULTADOS.

## Etapa 7 — CERRAR

El cierre son tres cierres, en orden:

### 7a. Cierre deportivo
- resultados revisados y validados (nada se publica sin validar);
- protestas resueltas y auditadas;
- clasificación final publicada en la landing;
- constancias/podios exportados.

### 7b. Cierre financiero
- conciliación automática: lo cobrado vs. lo depositado por Mercado Pago;
- reembolsos y contracargos resueltos;
- ingresos por producto, ventas de puerta, diferencias explicadas;
- exportación para contabilidad.

### 7c. Cierre operativo
- incidencias todas en estado resuelto (las abiertas se documentan);
- reporte ejecutivo del evento: inscritos vs. asistentes, conversión,
  ocupación por categoría, no-shows, tiempos de puerta;
- lecciones aprendidas registradas en el evento (campo libre, obligatorio).

**Sale cuando:** los tres cierres están completos. Estado → CERRADO.
El sistema muestra el checklist de cierre y qué falta de cada uno.

## Etapa 8 — ARCHIVAR

**Qué hace el sistema solo:**
- el evento pasa a solo-lectura (nadie edita historia);
- todos los participantes quedan en el CRM como PAST_PARTICIPANT,
  segmentables para el siguiente evento;
- resultados quedan públicos de forma permanente;
- exportación completa del evento (datos + documentos) como respaldo.

**El activo que queda:** una base de contactos con historial real —
la materia prima del próximo evento y, después, de la ENFORMA App.

---

## Reglas del ciclo

```text
R1  El estado del evento manda: cada pantalla y botón se habilita o
    bloquea según la etapa. No se puede escanear en BORRADOR ni vender
    en EN_RESULTADOS.
R2  Avanzar de etapa exige cumplir la condición de salida; el sistema
    muestra el checklist y qué falta.
R3  Retroceder de etapa es excepcional, requiere rol de dirección y
    queda auditado (ej. reabrir ventas).
R4  Las etapas 4 y 8 son del sistema; las personas solo supervisan.
R5  Un evento no se considera exitoso al terminar el día D, sino al
    llegar a CERRADO. El cierre es parte del evento, no un trámite.
R6  La PWA puede operar temporalmente sin internet, pero no sustituye a
    InsForge. La copia local expira y la autoridad canónica siempre vuelve
    al backend al sincronizar.
```

## Cómo se conecta con lo demás

| Etapa | Documento de soporte |
|---|---|
| 1–3 | Revisión final, nivel 0 (decisiones) |
| 4 | Plan v2 §2 (Mercado Pago) + journeys J1–J4 |
| 5 | Journeys J7 (staff) |
| 6 | Journeys J5, J6, J8, J10 + principios P1–P12 |
| 7 | Journeys J9 (resultados) y J11 (finance) |
| Construcción | Revisión final, niveles 1–4 (orden de importancia) |
