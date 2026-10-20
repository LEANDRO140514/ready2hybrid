# Runbook: extensión de preventa hasta el 26 de octubre

Estado: **PREPARADO, NO DESPLEGADO.** Solo se ejecuta cuando el propietario escribe
`PUBLICA PREVENTA`. Tiempo estimado: 5 minutos.

## Qué cambia

| | Antes (producción) | Después |
|---|---|---|
| PRESALE termina | 20-oct 00:00 America/Merida | **27-oct 00:00** |
| REGULAR empieza | 20-oct 00:00 | **27-oct 00:00** |
| REGULAR termina | 13-nov 00:00 | sin cambio |
| Etiqueta landing | `25 sep – 19 oct` / `20 oct – 12 nov` | `hasta el 26 de octubre` / `27 oct – 12 nov` |

No cambian precios, `CARDS_ONLY_FROM`, webhook, pagos ni migraciones. No hay SQL.

Precio de smoke (`HALF-IND-M`): PREVENTA 90000 centavos, REGULAR 100000.

## Artefactos (rama `feat/preventa-ext-27oct` en ambos repos)

| Repo | Commit | Contenido |
|---|---|---|
| `ready2hybrid-prorroga` (pagos) | `721c1fd`, sobre `f3f8f78` | `staged-pricing.ts` + `handler.deploy.js` de `mp-create-checkout` (diff del bundle: 2 líneas) |
| `hybrid-event-landing` | `8a185b0`, sobre `7371d43` (= `origin/main`) | `src/lib/pricingStage.ts` + `tests/pricing-stage.test.ts` |

Base de producción confirmada: la función viva `mp-create-checkout` es **idéntica** al
bundle de `f3f8f78` (`scripts/verify-deployed-function.mjs`).

## Plazo duro

Desplegar **antes de las 23:59 de hoy 19-oct (Mérida)**. Desde las 00:00 del 20-oct, el
servidor vivo cobra REGULAR. Quien compre entre el corte y el despliegue paga regular.

## 0. Antes de tocar nada (1 min)

```powershell
# Pagos: la base viva sigue siendo la esperada (debe decir IDENTICAL).
cd C:\Users\algor\dev\ready2hybrid-preventa-ext
$env:INSFORGE_CWD = 'C:\Users\algor\dev\ready2hybrid-prorroga'   # carpeta con .insforge/project.json
cmd /c "git show f3f8f78:insforge/functions/mp-create-checkout/handler.deploy.js > %TEMP%\mp-base.js"
node scripts/verify-deployed-function.mjs mp-create-checkout $env:TEMP\mp-base.js

# Landing: origin/main no se movió desde 7371d43.
cd C:\Users\algor\dev\hybrid-event-landing
git fetch origin; git rev-parse origin/main   # debe ser 7371d43...
```

Registra para rollback: URL del despliegue de producción actual de la landing
(`npx vercel ls --prod`, o el panel de Vercel) y `f3f8f78` como commit de pagos.

Si algo no coincide: **incidente, detente y reporta.**

## 1. Pagos: desplegar `mp-create-checkout` (1 min)

```powershell
cd C:\Users\algor\dev\ready2hybrid-prorroga          # el CLI necesita .insforge aquí
npx -y @insforge/cli functions deploy mp-create-checkout --file C:\Users\algor\dev\ready2hybrid-preventa-ext\insforge\functions\mp-create-checkout\handler.deploy.js
```

Verifica que lo vivo coincide con el commit (debe decir IDENTICAL):

```powershell
cd C:\Users\algor\dev\ready2hybrid-preventa-ext
$env:INSFORGE_CWD = 'C:\Users\algor\dev\ready2hybrid-prorroga'
node scripts/verify-deployed-function.mjs mp-create-checkout
```

## 2. Landing: publicar (1 min + build de Vercel)

La landing despliega por Git (push a `main` = producción). Fast-forward, sin force:

```powershell
cd C:\Users\algor\dev\hybrid-event-landing
git push origin feat/preventa-ext-27oct:main
```

Espera el build de Vercel (1–2 min). Comprueba que la página dice
"Preventa hasta el 26 de octubre" y "27 oct – 12 nov" (tabla de precios; en móvil,
"Preventa (hasta el 26 de octubre)").

El `main` local de ese repo queda atrasado: `git fetch` y `git checkout main && git merge --ff-only origin/main` cuando convenga.

## 3. Prueba de humo: preferencia real sin pagar (2 min)

Crea una orden PENDING y una preferencia de Mercado Pago. **No se paga.** Usa un correo
de prueba tuyo (no lo escribas en el repo). El nombre fijo permite localizarla.

Cuerpo (guárdalo como `%TEMP%\smoke-presale.json`, fuera del repo). Cambia `<UNICO>` en
cada corrida (por ejemplo `20261019-2230`):

```json
{"product_code":"HALF-IND-M","quantity":1,"idempotency_key":"smoke-presale-<UNICO>","selected_provider":"MERCADO_PAGO","buyer":{"email":"<TU_CORREO_DE_PRUEBA>","name":"Prueba humo preventa"}}
```

```powershell
curl.exe -sS -w "`nHTTP:%{http_code}`n" -X POST "https://4bg9ufz2.us-east.insforge.app/functions/mp-create-checkout" `
  -H "Origin: https://hybrid-experience.enforma.mx" -H "Content-Type: application/json" `
  --data-binary "@$env:TEMP\smoke-presale.json"
```

Esperado: HTTP 200 con preferencia. Luego el precio guardado (solo lectura):

```powershell
cd C:\Users\algor\dev\ready2hybrid-prorroga
npx -y @insforge/cli db query "select o.state, o.total_cents, o.commercial_snapshot->>'commercial_stage' as stage, o.created_at from public.orders o join public.buyer_contacts b on b.id=o.buyer_contact_id where b.name='Prueba humo preventa' order by o.created_at desc limit 1" --json
```

Debe dar `total_cents = 90000` y `stage = PRESALE`.

Haz la prueba **dos veces**:

1. **Ahora**, justo después de desplegar (antes de medianoche).
2. **Después de las 00:00 del 20-oct** (idealmente 00:01–00:15). Es la que prueba la
   extensión: con el código viejo daría `100000` / `REGULAR`.

Aceptación: ambas dan `90000` + `PRESALE`. Cualquier otro valor → rollback.

La orden de prueba queda PENDING y expira sola; los correos de prueba ya están
excluidos de los segmentos de marketing. No toques órdenes pagadas.

## 4. Registrar

Anotar en `WORKSPACE_STATUS.md` (log): commit `721c1fd`, hash de la función viva, URL de
despliegue previo de la landing, resultado de las dos pruebas de humo.

## Rollback (2 min)

**Pagos** (la función vuelve al bundle de `f3f8f78`):

```powershell
cd C:\Users\algor\dev\ready2hybrid-prorroga
cmd /c "git show f3f8f78:insforge/functions/mp-create-checkout/handler.deploy.js > %TEMP%\mp-rollback.js"
npx -y @insforge/cli functions deploy mp-create-checkout --file $env:TEMP\mp-rollback.js
```

Verifica con `scripts/verify-deployed-function.mjs mp-create-checkout %TEMP%\mp-rollback.js`.
Nota: ese archivo es una copia exacta de un commit; no es un bundle nuevo.

**Landing**: lo más rápido es restaurar el despliegue previo en Vercel
(`npx vercel rollback <URL-previa>` o botón "Instant Rollback"). Alternativa por Git:

```powershell
cd C:\Users\algor\dev\hybrid-event-landing-preventa-ext
git revert --no-edit 8a185b0
git push origin HEAD:main
```

**Ojo con la coherencia:** si se revierte solo uno de los dos, la landing y el servidor
muestran y cobran etapas distintas el 20–26 oct. Revierte ambos, o ninguno.

## Pendientes fuera de este cambio

- `docs/whatsapp-agent-*.md` y `whatsapp-agent-kb.pdf` en la landing mencionan "19 oct" /
  "20 oct". Si la extensión se confirma, hay que regenerar la KB (copy, no cobra).
- El paquete del 21 (REGULAR hasta 13-nov 11:00 y `CARDS_ONLY_FROM`) sigue sin desplegar y
  vive en el árbol de trabajo de `ready2hybrid-prorroga`. Al aplicarlo hay que reconciliar
  `PRESALE.endMs`/`REGULAR.startMs` con este cambio (ver conflicto en `staged-pricing.ts`).
