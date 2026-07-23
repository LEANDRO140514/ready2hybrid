# Ready2Hybrid — Orden de importancia, desarrollado para revisión final

> Este documento consolida el plan v2 y los customer journeys en un solo
> orden de prioridad, desarrollado para que lo apruebes bloque por bloque.
> Cómo revisarlo: cada nivel termina con **[ APROBAR / AJUSTAR ]** y la
> sección 7 concentra las decisiones que solo tú puedes tomar.
>
> Distinción clave: el ORDEN DE IMPORTANCIA no es solo el orden de
> construcción — es la regla de recorte. Si el tiempo aprieta, se sacrifica
> de abajo hacia arriba, nunca al revés.

---

## 1. La pirámide de importancia

```text
N0  DECIDIR      contrato de producto           sin esto, nada arranca
N1  COBRAR       núcleo + Mercado Pago          sin esto, no hay evento
N2  ENTRAR       staff + check-in offline       sin esto, el día D colapsa
N3  COMPETIR     hybrid + timing + results      sin esto, no hay deporte
N4  ADMINISTRAR  panel + CRM + finance          sin esto, hay caos silencioso
N5  CRECER       comms, carreras, torneos       sin esto, no pasa nada… aún
```

Por qué este orden y no otro:

- **N1 sobre todo lo demás:** cada semana sin pasarela es venta perdida; la
  landing ya existe y está muda.
- **N2 sobre N3:** un evento con resultados en Excel sobrevive; un evento con
  400 personas atoradas en la puerta a 34 °C en Mérida, no.
- **N3 sobre N4:** publicar resultados confiables es la promesa del producto;
  el panel bonito puede esperar, la clasificación no.
- **N4 es transversal:** partes de él (acciones protegidas, ficha 360) se
  construyen dentro de N1–N3 porque los journeys las exigen; lo que va aquí
  es su versión completa.

---

## 2. NIVEL 0 — Decidir (contrato de producto)

**Qué es:** congelar `spec-v1.md`. Días de trabajo, no semanas. Bloquea N1.

**Contenido a aprobar (desarrollado en la sección 7):** productos y precios,
métodos de pago, política de reembolso, datos mínimos, waiver, cupos.

**Criterio de terminado:** spec firmada; cualquier cambio posterior es
versión nueva con impacto evaluado, no edición silenciosa.

**Qué NO se decide aquí:** nada de diseño de pantallas ni de módulos futuros.

**[ APROBAR / AJUSTAR ]**

---

## 3. NIVEL 1 — Cobrar (núcleo + pay-mercadopago)

**Qué incluye**

```text
Backend InsForge:  contacts, events, event_products, registrations,
                   registration_members, orders, order_items, payments,
                   tickets, waivers, emergency_contacts, webhook_events,
                   activity_log, domain_events, modules, event_modules
Funciones:         mp-create-checkout, mp-webhook, get-order-status
Adaptador:         PaymentProvider (MP es la primera implementación)
Landing:           conexión real del formulario y página de "confirmando…"
Correos:           confirmación con folio + QR; voucher de efectivo con vigencia
Journeys cubiertos: J1 (tarjeta), J2 (efectivo), J3 (asistente), J4 (capitán)
```

**Desarrollo de los puntos finos**

1. *Idempotencia:* `webhook_events UNIQUE(provider, provider_event_id)`;
   notificación duplicada → 200 y salir. El estado del pago SIEMPRE se lee de
   la API de MP, nunca del cuerpo de la notificación ni del redirect.
2. *Efectivo asíncrono:* cupo reservado mientras el voucher viva; job diario
   libera vencidos y notifica al comprador (J2, etapa 4b).
3. *Cupos concurrentes:* verificación con lock dentro de `mp-create-checkout`;
   prueba obligatoria de compras simultáneas del último lugar.
4. *Equipos (J4):* enlace de roster + waiver individual por miembro; el
   recordatorio automático al capitán es parte de este nivel, no de comms
   (es una plantilla de correo transaccional, no una campaña).
5. *Seguridad:* anon sin escritura en ninguna tabla; secretos de MP en
   InsForge Secrets; firma x-signature verificada.

**Criterio de terminado (definition of done)**

```text
✓ los 8 casos de prueba de F2 del plan v2 en sandbox
✓ diagnóstico de notificaciones del MCP de MP sin fallas de entrega
✓ pago real mínimo con tarjeta Y con efectivo en productivo, con reembolso
✓ puntos 1–7 del checklist MVP del plan maestro
```

**Si falta tiempo, se recorta:** MSI (se activan después sin código), correo
bonito (texto plano sirve), página pública de consulta de ticket.
**No se recorta jamás:** idempotencia, firma del webhook, auditoría, cupos,
emisión única del ticket, token QR sin datos personales y autoridad canónica
de InsForge.

**[ APROBAR / AJUSTAR ]**

---

## 4. NIVEL 2 — Entrar (staff + check-in)

**Qué incluye**

```text
Módulo staff:    stf_profiles, stf_shifts, stf_assignments, stf_accreditation,
                 correo automático de turno, tablero de confirmación (J7)
Módulo checkin:  PWA offline-first, manifiesto a IndexedDB, escaneo QR,
                 búsqueda por nombre, kits y tallas, incidencias automáticas,
                 cola de sincronización, lista imprimible (J5)
Mesa de soluciones (subset de N4 adelantado): ficha 360 de solo-lo-necesario
                 + acciones protegidas: verificar pago en MP, reenviar QR,
                 registrar pago en sitio, firmar waiver en sitio (J6)
```

**Desarrollo de los puntos finos**

1. *Offline es el modo normal, no el plan B:* la app opera idéntico con y sin
   red; el banner "LISTO PARA OPERAR SIN INTERNET · N tickets" es requisito
   de apertura de puertas (regla del manual).
2. *Conflictos:* primer escaneo gana; el segundo genera incidencia sola. El
   staff de puerta canaliza, nunca resuelve (P11).
3. *Mesa de soluciones adelantada:* J6 demuestra que sin ella el día D se
   atora igual; por eso sus 4 acciones protegidas suben a este nivel aunque
   "pertenezcan" al CRM.
4. *UX bajo sol:* pantallas semafóricas gigantes (P3), cero teclado salvo
   3 letras de búsqueda (P4).
5. *InsForge manda:* la PWA descarga una copia mínima y expirable. Emitir,
   revocar, reemitir y resolver check-ins es responsabilidad de InsForge.
6. *QR seguro:* el código contiene solo un token opaco; nunca PII, pagos o
   datos médicos. Reemitir invalida el token anterior.

**Criterio de terminado**

```text
✓ ensayo general: 50 check-ins consecutivos con wifi apagado, sincronización
  limpia al volver la red, doble escaneo detectado
✓ los 4 botones de la mesa de soluciones funcionando y auditados
✓ staff recibe su turno por correo y aparece como operador en cada escaneo
✓ puntos 9–10 del checklist MVP
✓ principios P1–P5, P9, P11, P12 verificados en sitio
✓ webhook duplicado no crea tickets adicionales
✓ QR emitido, revocado y reemitido correctamente
✓ dos celulares escanean el mismo QR offline: uno gana y otro crea incidencia
✓ manifiesto expirado bloquea apertura y logout borra datos locales sensibles
```

**Si falta tiempo, se recorta:** drag&drop de reasignación (se hace con un
select), acreditación con QR de staff (gafete impreso simple).
**No se recorta jamás:** modo offline, autoridad de InsForge, emisión única,
revocación/reemisión, sincronización idempotente, resolución de duplicados,
búsqueda por nombre, incidencia automática y auditoría de operador/dispositivo.

**[ APROBAR / AJUSTAR ]**

---

## 5. NIVEL 3 — Competir (hybrid + timing + results)

**Qué incluye**

```text
Módulo hybrid:   categorías, formatos, heats, carriles, estaciones,
                 asignación automática + ajuste manual
Módulo timing:   app de juez (J8): iniciar heat, tap = split, tap largo =
                 penalización, finalizar carril, deshacer 30 s, offline
Módulo results:  cola de revisión (J9), recálculo al vuelo,
                 UNDER_REVIEW → VALIDATED → PUBLISHED,
                 leaderboard público en la landing, export CSV
Dashboard día D (subset de N4 adelantado): la pantalla única del director (J10)
```

**Desarrollo de los puntos finos**

1. *Separación timing/results:* timing no sabe de rankings; results no captura
   nada. Es lo que permitirá reutilizar ambos en carreras y torneos (N5) sin
   tocarlos.
2. *El juez no calcula (P6):* penalizaciones se eligen de lista, el sistema
   las aplica; el resumen del heat se firma, no se suma.
3. *Nada llega al público sin VALIDATED;* publicar es un tap deliberado por
   heat o categoría, reversible con auditoría.
4. *Retraso en bloque:* el control "+15 min a todo lo que sigue" del director
   vive aquí porque reprograma heats (J10).
5. *Leaderboard:* función pública de solo lectura; Realtime es deseable, el
   refresh de 30 s es aceptable para la primera edición.

**Criterio de terminado**

```text
✓ simulacro completo: 2 categorías, 4 heats, penalizaciones, una protesta
  corregida, publicación y leaderboard visible desde un celular externo
✓ puntos 11–14 del checklist MVP  →  MVP COMPLETO
✓ principios P6, P7, P10 verificados
```

**Si falta tiempo, se recorta:** Realtime (queda polling), asignación
automática de heats (manual con buena UI), splits por estación (solo
inicio/fin + penalizaciones — el propio plan maestro lo permite).
**No se recorta jamás:** flujo de validación, auditoría de correcciones,
deshacer del juez.

**[ APROBAR / AJUSTAR ]**

---

## 6. NIVEL 4 — Administrar (versión completa)

Lo no adelantado en N2/N3:

```text
CRM completo:   búsqueda avanzada, etiquetas, tareas, duplicados, segmentos,
                exportaciones, ciclo de vida del contacto
Dashboard ejecutivo pre-evento: ventas, conversión, ocupación, pendientes
Finance (J11):  conciliación diaria automática, reembolsos de un botón,
                cierre post-evento
Reportes:       los tres bloques del plan maestro (antes / durante / después)
Roles:          los 11 roles completos (v1 opera con 4)
```

**Criterio de terminado:** punto 8 del MVP en su versión completa + reporte
ejecutivo post-evento exportable + conciliación cuadrada contra MP.

**Naturaleza de este nivel:** es el único que puede terminarse DESPUÉS de
abrir ventas e incluso solaparse con N2/N3, porque sus piezas críticas ya
subieron de nivel. Por eso es N4 en importancia aunque parte de él se
construya temprano.

**[ APROBAR / AJUSTAR ]**

---

## 7. Decisiones para tu firma (bloquean N0 → N1)

| # | Decisión | Recomendación por defecto | Tu decisión |
|---|---|---|---|
| 1 | Precios por modalidad (individual / pareja / relevo) y asistente | — (solo tuya) | ______ |
| 2 | Cupos por categoría | — (solo tuya) | ______ |
| 3 | ¿MSI? | Sí, 3 MSI desde $1,500 MXN; absorber costo en precio | ______ |
| 4 | ¿Efectivo (OXXO/Paycash)? | Sí; voucher con vigencia de 72 h, cupo reservado mientras | ______ |
| 5 | Política de reembolso | Sin reembolsos; transferencia de lugar hasta 14 días antes, vía mesa/CRM | ______ |
| 6 | Cierre de ventas en línea | 48 h antes del evento; después solo venta en puerta | ______ |
| 7 | ¿Venta en puerta día D? | Sí, solo asistentes, con "Registrar pago en sitio" | ______ |
| 8 | Datos mínimos del competidor | nombre, fecha nac., sexo/categoría, correo, teléfono, talla, contacto de emergencia, condición médica relevante (opcional) | ______ |
| 9 | Texto del waiver | redactarlo con tu asesor legal; el sistema versiona y sella aceptación | ______ |
| 10 | Fecha objetivo de apertura de ventas | ≥ 8 semanas antes del evento (define todo el calendario hacia atrás) | ______ |

---

## 8. Calendario hacia atrás (relativo al día del evento = D)

```text
D-10 sem   N0 firmado, N1 en construcción
D-8  sem   N1 TERMINADO → APERTURA DE VENTAS  ← hito inamovible
D-8→D-3    N4 parcial (CRM/panel) en paralelo con ventas corriendo
D-5  sem   N2 terminado (staff + check-in) — margen para el ensayo
D-3  sem   N3 terminado — margen para el simulacro completo
D-2  sem   ensayo general de puerta sin wifi + simulacro de competencia
D-1  sem   congelamiento: solo correcciones, cero features
D          evento
D+2  sem   cierre financiero y reporte ejecutivo (N4 completo)
después    N5 según el segundo evento real (carrera → races primero)
```

Si la fecha del evento está a menos de 10 semanas, la pirámide dicta el
recorte: se aplican primero las listas de "si falta tiempo" de N3, luego N2.
N1 y N0 no se recortan.

---

## 9. Cierre de la revisión

Para dar por aprobado este documento:

```text
1. Marcar APROBAR/AJUSTAR en los niveles 0–4
2. Llenar la columna "Tu decisión" de la sección 7
3. Confirmar la fecha del evento (ancla la sección 8)
```

Con eso, el siguiente entregable es mecánico: `spec-v1.md` + migraciones del
núcleo (`insforge/schema/000X_*.sql`) + esqueleto de `pay-mercadopago`, y
arranca N1 bajo el protocolo de fases del workspace.

---

## 10. Puerta técnica transversal confirmada

```text
✓ Vite + React 19 + TypeScript strict; no Next.js
✓ npm run typecheck, test y build en verde
✓ PWA instalable y actualización del service worker probada
✓ IndexedDB y cola offline probadas
✓ lógica sensible fuera del navegador y dentro de InsForge Functions/RLS
✓ Cursor, el modelo seleccionado y los MCP no redefinen stack ni autoridad
```
