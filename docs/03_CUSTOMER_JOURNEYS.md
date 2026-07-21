# Customer journeys Ready2Hybrid — base del manual de operación

> Propósito: mapear el recorrido de cada actor para que el manual de operación
> y las pantallas se diseñen desde la facilidad de operación, no desde las
> tablas. Regla madre: **el sistema hace el trabajo; la persona solo decide.**
>
> Formato de cada journey:
> ETAPA → lo que hace la persona / lo que hace el sistema solo / dolor que se
> elimina. Al final, los principios duros que el manual debe imponer.

---

## A. Journeys externos (quien compra y compite)

### J1 — Competidor individual (tarjeta)

```text
1. DESCUBRE      ve la landing del Hybrid Event
   Sistema:      nada que operar; el chat de la landing crea lead en CRM si pregunta
   Dolor fuera:  nadie captura leads a mano

2. SE REGISTRA   elige modalidad y categoría, llena UN formulario corto
   Sistema:      valida cupo en vivo, crea contact + registration, muestra
                 waiver para aceptar antes de pagar
   Dolor fuera:  no hay cuenta que crear, no hay contraseña, no hay doble captura

3. PAGA          redirigido a Checkout Pro, paga con tarjeta (MSI si aplica)
   Sistema:      webhook confirma, asigna folio, emite ticket QR, manda
                 confirmación; página de éxito solo muestra "confirmando…"
                 hasta que el webhook resuelva
   Dolor fuera:  cero confirmaciones manuales; nadie "revisa si ya pagó"

4. ESPERA        recibe correo con folio, QR, categoría, fecha y qué llevar
   Sistema:      recordatorios automáticos (hora de llamada, sede, calor:
                 hidratación, llegar temprano)
   Dolor fuera:  el operador no contesta 200 veces "¿a qué hora llego?"

5. LLEGA         muestra QR desde el celular (o dice su nombre)
   Sistema:      check-in en un escaneo, indica talla y kit al staff
   Dolor fuera:  sin listas impresas como flujo principal, sin buscar en Excel

6. COMPITE       se presenta a su heat a la hora de llamada
   Sistema:      su heat/carril ya está asignado y visible en la confirmación
                 y en pantallas de sede
   Dolor fuera:  nadie improvisa asignaciones con megáfono

7. RESULTADO     consulta el leaderboard público desde su celular
   Sistema:      publica al validar el juez; sin pasos manuales extra
   Dolor fuera:  cero "¿ya salieron los resultados?" al staff

8. DESPUÉS       queda en el CRM como PAST_PARTICIPANT
   Sistema:      segmentable para el siguiente evento
```

### J2 — Competidor que paga en efectivo (variante crítica)

```text
1-2. igual que J1
3. ELIGE EFECTIVO  Checkout Pro le da voucher OXXO/Paycash con vigencia
   Sistema:        registration queda PENDING_PAYMENT con CUPO RESERVADO
                   hasta la expiración; correo con el voucher y la fecha límite
4. PAGA EN TIENDA  (horas o días después)
   Sistema:        webhook async → CONFIRMED → folio + QR + correo, solo
   Dolor fuera:    nadie concilia vouchers a mano
4b. NO PAGA        vence el voucher
   Sistema:        libera cupo, marca CANCELLED, correo "tu lugar se liberó,
                   puedes volver a intentarlo"; el CRM lo deja como lead tibio
   Dolor fuera:    cupos fantasma bloqueando ventas
```

**Regla para el manual:** un pago en efectivo pendiente NUNCA se confirma a
mano "porque el cliente mandó foto del voucher". Si el webhook no llegó,
FINANCE usa la acción protegida "verificar pago en Mercado Pago" (consulta a
la API), no un cambio de estado directo.

### J3 — Asistente / espectador

```text
1. COMPRA     elige cantidad de accesos, da UN correo de comprador
2. PAGA       igual que J1/J2
3. RECIBE     N tickets QR individuales en un solo correo
4. ENTRA      cada QR se escanea una vez; el segundo intento del mismo QR
              alerta al staff (posible reenvío/duplicado)
Dolor fuera:  no se piden datos de cada acompañante; un comprador, N accesos
```

### J4 — Pareja / relevo (capitán)

```text
1. CAPITÁN REGISTRA  crea el equipo, elige categoría, paga completo
   Sistema:          equipo PROVISIONAL + enlace único para completar miembros
2. MIEMBROS SE SUMAN cada uno abre el enlace, llena sus datos y acepta SU waiver
   Sistema:          marca al equipo ELEGIBLE cuando el roster está completo;
                     recordatorio automático al capitán si falta alguien a X días
3. DÍA DEL EVENTO    cada miembro tiene su propio QR; check-in individual
Dolor fuera:         el capitán no dicta datos ajenos por teléfono; nadie
                     persigue waivers en la mesa de registro
```

---

## B. Journeys internos (la operación — corazón del manual)

### J5 — Staff de check-in (el journey más exigente del sistema)

```text
ANTES DE ABRIR   inicia sesión en su celular, abre /checkin
   Sistema:      descarga el manifiesto completo a IndexedDB y muestra
                 "LISTO PARA OPERAR SIN INTERNET · N tickets cargados"
   Regla:        el manual prohíbe abrir puertas sin ver ese banner

FLUJO FELIZ      apunta la cámara al QR
   Sistema:      valida contra copia local en <1 s, pantalla VERDE gigante con
                 nombre, categoría y talla de playera → staff entrega kit → listo
   Taps:         CERO taps en el caso feliz; escanear ES el check-in

SIN QR           botón grande "Buscar por nombre" → teclea 3 letras
   Sistema:      resultados locales instantáneos → tap en la persona → check-in
   Taps:         máximo 2

PANTALLA ROJA    QR ya usado / no pagado / waiver faltante
   Sistema:      muestra EL MOTIVO y EL SIGUIENTE PASO en la misma pantalla
                 ("Enviar a mesa de soluciones"), y crea la incidencia sola
   Regla:        el staff de puerta nunca discute ni resuelve; canaliza

SE CAE INTERNET  nada cambia visualmente
   Sistema:      encola check-ins, ícono discreto "N pendientes de sincronizar",
                 sincroniza solo al volver la red; conflictos entre dispositivos
                 los resuelve el servidor (primer escaneo gana, el otro →
                 incidencia automática)
   Regla:        el manual dice explícitamente: "si no hay internet, sigue
                 escaneando; no avises, no te detengas"

RESPALDO FINAL   lista imprimible exportada la noche anterior

CARTA RESPONSIVA (dentro de la entrega de kit — obligatoria)
   Flujo:        escaneo verde → la pantalla muestra el estado de la carta:
                 ○ FIRMADA EN SITIO  → entregar kit + chip directo
                 ○ PENDIENTE         → firma en tablet ahí mismo (o firma
                   en papel pre-impreso con su folio y el staff la marca
                   con un tap) → entregar kit + chip
   Regla dura:   SIN CARTA FIRMADA NO HAY KIT NI CHIP. El sistema bloquea
                 el registro de entrega hasta que la carta esté firmada.
   Doble capa:   al comprar en línea aceptó los términos (checkbox con
                 versión y timestamp); la firma autógrafa del día del
                 registro es la definitiva para la aseguradora.
   Menores:      firma del padre o tutor presente, marcada como tal.
   Equipos:      cada integrante firma la SUYA en su propio check-in;
                 el capitán no firma por nadie.
   Padrón:       Caja exporta "cartas firmadas" cruzado con el padrón
                 del seguro — mismo reporte, dos destinatarios.
```

### J6 — Mesa de soluciones (CRM en sede)

Persona con problema llega desviada desde la puerta.

```text
1. BUSCA         nombre o correo → ficha 360 en una pantalla:
                 registro, orden, pago, tickets, waiver, incidencia de puerta
2. RESUELVE      con ACCIONES PROTEGIDAS de un botón, nunca editando tablas:
                 - "Verificar pago en Mercado Pago" (consulta API en vivo)
                 - "Reenviar confirmación/QR"
                 - "Registrar pago en sitio" (efectivo/terminal, queda auditado)
                 - "Firmar waiver en sitio" (firma en el celular/tablet)
                 - "Cambiar talla/categoría" (si hay cupo, queda auditado)
3. CIERRA        marca la incidencia resuelta; la persona regresa a la puerta
Meta del manual: NINGÚN caso debe requerir "hablarle al programador".
                 Si un caso lo requiere, es un defecto del sistema, se registra.
```

### J7 — Coordinador de staff

```text
SEMANAS ANTES   alta de staff (link a contact), roles, turnos por día
   Sistema:     genera acreditación con QR de staff; correo automático a cada
                quien con SU turno, SU área y SU responsable
DÍA -1          tablero "¿quién falta por confirmar turno?"
DÍA D           reasignaciones drag&drop (se cayó alguien → arrastrar a otro)
   Sistema:     emite staff.assigned; checkin y timing ven al operador correcto
Dolor fuera:    WhatsApp como sistema de turnos
```

### J8 — Juez de estación / heat (módulo timing)

```text
1. LLEGA        abre su celular, ve SOLO sus heats asignados de hoy
2. HEAT LLAMADO tap "Iniciar heat" → cronómetro común del heat corre
3. CAPTURA      por carril: tap = split de estación; tap largo = penalización
                (elige tipo de una lista corta, sin teclear)
4. TERMINA      tap "Finalizar carril" al cruzar meta → hora fin sola
5. FIRMA        revisa el resumen del heat, tap "Enviar a revisión"
   Sistema:     todo queda en UNDER_REVIEW; el juez no calcula nada
Taps máximos:   3 por acción; CERO teclado en cancha
Corrección:     "me equivoqué de carril" → deshacer último toque (30 s),
                después solo corrige el operador de resultados, auditado
Sin internet:   igual que check-in: captura local, sincroniza después
```

### J9 — Operador de resultados (módulo results)

```text
1. COLA          ve heats en UNDER_REVIEW conforme los jueces envían
2. REVISA        pantalla lado a lado: tiempos crudos vs. resultado calculado
                 (penalizaciones ya aplicadas por el sistema)
3. AJUSTA        corrige un split o resuelve una protesta → recálculo al vuelo
4. VALIDA        tap "Validar" → VALIDATED
5. PUBLICA       tap "Publicar" (por heat o por categoría completa)
   Sistema:      leaderboard público se actualiza solo (Realtime)
Regla:           nada llega al público sin pasar por VALIDATED; y validar
                 nunca requiere hoja de cálculo externa
```

### J10 — Director del evento (día D)

```text
UNA SOLA PANTALLA, sin navegación, en tablet:
├── check-ins vs. esperados (y ritmo por minuto)
├── próximos 3 heats y retraso acumulado
├── no-shows por categoría
├── incidencias ABIERTAS por severidad (médicas arriba, en rojo)
├── resultados pendientes de validar
└── ventas de puerta del día
Acciones:  reasignar responsable de incidencia; retrasar programa en bloque
           ("+15 min a todo lo que sigue") con un solo control
Regla:     el director no captura nada; solo ve y decide
```

### J11 — Finance

```text
PRE-EVENTO    conciliación diaria: órdenes PAID vs. dinero en Mercado Pago
   Sistema:   reporte automático de diferencias; vouchers por vencer
REEMBOLSO     solicitud llega como tarea desde CRM → botón "Reembolsar"
              (usa el adaptador de pasarela) → estados y correo automáticos
POST-EVENTO   cierre: ingresos por producto, reembolsos, contracargos,
              exportación CSV para contabilidad
Regla:        FINANCE no ve contactos de emergencia ni datos médicos;
              CHECKIN_STAFF no ve pagos. Lo impone el sistema, no el manual.
```

---

## C. Principios de facilidad de operación (extraídos de los journeys)

Estos son requisitos verificables en el VALIDATE de cada fase, no consejos:

```text
P1  Caso feliz sin taps        el flujo más frecuente de cada rol se completa
                               con 0–2 toques (escanear = check-in; tap = split)
P2  Una pantalla por rol       cada rol operativo trabaja en UNA vista;
                               si necesita navegar en vivo, está mal diseñado
P3  Pantallas semafóricas      verde/rojo gigantes, legibles a pleno sol,
                               con EL MOTIVO y EL SIGUIENTE PASO incluidos
P4  Sin teclado en cancha      todo lo del día D se opera con toques y listas;
                               teclear solo en búsqueda por nombre (3 letras)
P5  Offline por defecto        checkin y timing operan igual sin internet;
                               la sincronización nunca es tarea del humano
P6  El sistema calcula, el     nadie suma tiempos, aplica penalizaciones ni
    humano valida              concilia pagos a mano; los humanos aprueban
P7  Acciones, no ediciones     todo cambio sensible es un botón con nombre de
                               negocio ("Registrar pago en sitio"), auditado;
                               jamás editar un campo de estado directo
P8  Nunca pedir lo que ya      ningún formulario ni pantalla pide un dato que
    se sabe                    el sistema ya tiene (talla, categoría, folio)
P9  Todo error tiene salida    cada pantalla roja dice qué hacer después;
                               "no se puede" sin siguiente paso está prohibido
P10 Deshacer antes que pedir   errores de captura recientes se deshacen en
    permiso                    sitio (30 s); después, corrección auditada
P11 Escalar es un flujo        puerta → mesa de soluciones → director;
                               el manual nombra el camino, el sistema lo crea
                               (incidencias automáticas), nadie improvisa
P12 Papel como último respaldo listas imprimibles exportables siempre, usadas
                               nunca (si se usaron, hubo un defecto: registrar)
```

## D. Mapa journeys → módulos → capítulos del manual

| Journey | Módulos | Capítulo del manual de operación |
|---|---|---|
| J1–J4 | núcleo + pay-mercadopago | "Qué ve el cliente" (contexto para soporte) |
| J5 | checkin, staff | Cap. 1 — Operar la puerta |
| J6 | crm, núcleo | Cap. 2 — Mesa de soluciones |
| J7 | staff | Cap. 3 — Coordinar al equipo |
| J8 | hybrid, timing | Cap. 4 — Juzgar un heat |
| J9 | results | Cap. 5 — Validar y publicar |
| J10 | dashboard (shell) | Cap. 6 — Dirigir el día D |
| J11 | núcleo, pay-mercadopago | Cap. 7 — Dinero |

El manual se redacta POR ROL siguiendo su journey, con capturas de pantalla
reales de cada etapa, y cierra cada capítulo con "si pasa X, haz Y" tomado de
las pantallas rojas (P9). Los principios P1–P12 son también la lista de
verificación de UX antes de cerrar F3, F4 y F5.
