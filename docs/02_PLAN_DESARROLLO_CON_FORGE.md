# Plan de desarrollo Ready2Hybrid — edición Forge

> Sustituye la sección 5 de R2R_A_R2H_PRACTICO.md. Mismo alcance (15-19
> tablas, 4 functions, 6 pantallas, 8 semanas), ahora con Forge como
> constructor y sus comandos como puertas de calidad de cada fase.
> Regla general: **Manual Build siempre** (aprobar fase por fase);
> Forge Mode autónomo no se usa en este proyecto — hay pagos y datos
> de 500–700 personas de por medio.

## Ajustes al plan por adoptar Forge

```text
1. Stack: Next.js App Router (Golden Path de Forge; sus comandos de
   PWA, auth y auditoría lo asumen). Adiós Vite SPA.
2. Correos: /add-emails (Resend + React Email) sustituye a nuestra
   edge function send-email artesanal. Menos código nuestro.
3. Check-in PWA: /add-mobile da el service worker y push como base;
   nosotros agregamos SOLO la capa offline (IndexedDB + cola).
4. Pagos: /add-payments NO aplica (solo sabe Polar/Stripe).
   Mercado Pago se construye a mano con su MCP conectado al IDE.
   Es la única pieza 100% artesanal del proyecto — por eso lleva
   la puerta de calidad más dura (ver semana 2).
5. El Blueprint NO se inventa: /plan se ancla a docs/. Si el
   Blueprint generado contradice los docs, mandan los docs.
```

## CALENDARIO REAL — evento: jueves 9 de octubre de 2026

> Hay venta activa ANTES de que exista el sistema. Por eso la semana 1
> incluye importar y capturar lo ya vendido: el sistema debe nacer como
> fuente de verdad, no vacío.

```text
Jul 20–22   Sem 0   forge init + Blueprint + InsForge      (comprimida a 3 días)
Jul 23–Ago 2  S1-2  núcleo + IMPORTAR VENTAS EXISTENTES +
                    captura manual + Mercado Pago           → venta automática
Ago 3–16    S3-4    pantallas Evento / Personas / Caja
Ago 17–23   S5      check-in + ensayo sin wifi
Ago 24–Sep 6  S6-7  competencia + staff + simulacro
Sep 7–13    S8      /temple + /web-audit + endurecer
Sep 14–24   colchón simulacro general, pendientes, manual de operación
Sep 25      CONGELAR  solo correcciones desde aquí
Oct 7       ensayo en sede (puerta + heats con staff real)
Oct 9       EVENTO
```

Regla del calendario: si una semana se desborda, se recorta alcance con
las listas de la Revisión Final (nunca se recorre el congelamiento).

### Añadido a la semana 1: absorber la venta ya iniciada

```text
1. Exportar lo vendido hasta hoy (Excel/lista/transferencias) a UN CSV:
   nombre, correo, teléfono, categoría, monto, cómo pagó, fecha
2. Función import-registrations: crea contact + registration CONFIRMED
   + payment con método "externo" + folio + ticket QR + correo con su QR
   (los que ya pagaron reciben su ticket formal — se ven beneficiados)
3. Pantalla mínima "captura rápida": mientras la pasarela no esté viva,
   cada venta manual nueva se registra ahí EL MISMO DÍA, no en Excel
4. Al encender Mercado Pago, la captura rápida queda solo para venta
   en efectivo presencial (auditada), y el Excel muere para siempre
```

## Semana 0 — Instalar la fragua (1–2 días)

```text
forge init                     capa Forge sobre el repo ready2hybrid
/forge-check                   MCPs (InsForge + Mercado Pago), git, deps
/plan                          → "usa docs/R2R_A_R2H_PRACTICO.md y
                                  docs/CICLO_DEL_EVENTO_R2H.md como fuente;
                                  no redefinas alcance"
/forge-init                    recorta CLAUDE.md al modo del proyecto
/add-insforge                  SDK, auth, profiles conectados
/design                        DESIGN.md desde la identidad de la landing
                               (extraerla del sitio existente vía Playwright)
Puerta de salida:  Blueprint aprobado por ti, alineado a los docs,
                   y /forge-check en verde.
```

## Semanas 1–2 — Vender (la landing cobra)

```text
Construir:   migraciones 0001 (núcleo) + seeds (evento, productos con
             precios provisionales editables), create-checkout,
             mp-webhook idempotente, /add-emails para confirmación
             con folio + QR, página "confirmando…" en la landing.
Con Forge:   /build fase 1 (Manual) · MCP de MP para la integración
             y para diagnosticar notificaciones.
PUERTA DURA: /adversarial-review sobre checkout + webhook.
             El Caos (race conditions) atacando el cupo del último
             lugar y El Intruso (OWASP) atacando el webhook son
             exactamente nuestros dos riesgos reales.
             No se abre venta sandbox con Resilience Score bajo.
Salida:      pago sandbox tarjeta y efectivo completos; notificación
             duplicada sin efectos; voucher vencido libera cupo.
             → LA LANDING VENDE (sandbox → productivo tras pago real)
```

## Semanas 3–4 — Administrar (pantallas 1, 2 y 6)

```text
Construir:   Evento (productos y tabla de precios ajustable con
             snapshot por orden), Personas (búsqueda + ficha + acciones
             protegidas), Caja (ventas, conciliación MP, export CSV).
Con Forge:   /add-ui-kit (componentes con tokens de DESIGN.md),
             /build fases 2-3, /kanban para seguimiento.
Puertas:     /normalize (que nada se desvíe del design system),
             /inspeccionar (TypeScript strict, RLS, seguridad).
Salida:      operas ventas reales sin tocar la base a mano.
```

## Semana 5 — Entrar (pantalla 3, check-in)

```text
Construir:   /add-mobile (PWA + service worker) → encima: manifiesto
             a IndexedDB, escaneo QR local <1s, cola de sincronización,
             búsqueda 3 letras, kits/tallas, incidencia automática.
Puertas:     /critique con foco en legibilidad a pleno sol y pantallas
             semafóricas (principios P1–P5 de los journeys).
             ENSAYO FÍSICO: 50 escaneos con wifi apagado, 3 celulares.
Salida:      puerta lista para 5+ personas/minuto.
```

## Semanas 6–7 — Competir (pantallas 4 y 5)

```text
Construir:   Competencia: categorías, heats (asignación automática:
             con 50-60 heats para 600 atletas, manual no es opción),
             lista de salida imprimible, captura de juez por toques,
             validar → publicar, leaderboard público en la landing.
             Staff: turnos, tareas, incidencias, correo de asignación.
Con Forge:   /build fases 4-5, referencia al repo de Ready2Race para
             el modelado de matches/rounds cuando haya dudas.
Puertas:     /adversarial-review ligero sobre publicación de
             resultados (El Saboteador: UX rota del juez bajo presión),
             /inspeccionar.
Salida:      simulacro: 2 categorías, 4 heats, 1 protesta corregida,
             leaderboard visible desde un celular externo.
```

## Semana 8 — Endurecer y congelar

```text
/temple            auditoría integral (bloquea si hay crítico)
/web-audit         Core Web Vitals y accesibilidad del leaderboard
                   público y la landing
/despachar         pipeline de cierre: typecheck, lint, build, PR
Simulacro general  puerta sin wifi + competencia completa + cierre
                   de caja el mismo día
CONGELAR           de aquí al evento: solo correcciones, cero features
```

## Ritual de cada sesión de trabajo (transversal)

```text
Abrir:   /avivar               (recupera contexto del proyecto)
         leer WORKSPACE_STATUS.md
Cerrar:  actualizar WORKSPACE_STATUS.md (qué se hizo, qué decidiste)
         /retro al cerrar cada semana-fase
Nunca:   dejar que un comando de Forge "mejore" alcance no pedido;
         los docs/ mandan sobre cualquier sugerencia del constructor.
```

## Mapa fase → puerta de calidad

| Fase | Puerta que la cierra |
|---|---|
| 0 instalación | /forge-check verde + Blueprint fiel a docs |
| 1-2 vender | /adversarial-review (Resilience alto) + pruebas MP |
| 3-4 administrar | /normalize + /inspeccionar |
| 5 entrar | /critique + ensayo físico sin wifi |
| 6-7 competir | simulacro de competencia + /inspeccionar |
| 8 congelar | /temple sin críticos + /web-audit + simulacro general |

## Post-evento

```text
/retro del proyecto completo + lecciones al cierre del evento (etapa 7c)
/graduate cuando decidas si R2H escala a más eventos/motores
/eject-forge solo si algún día distribuyes el código sin la capa Forge
```
