# Despliegue del dashboard de Finanzas

Procedimiento de salida. No autoriza ejecutarlo. No aplica SQL, no despliega la función y no publica la PWA.

Estado de esta revisión: **NO-GO**.

## 1. Deployability de `ops-sales-read`

El CLI vigente (`functions deploy --help` y el comando en `@insforge/cli`) hace esto:

1. Lee **un** archivo con `readFileSync(path, "utf-8")`.
2. Envía ese texto como `code` en `POST /api/functions` o `PUT /api/functions/:slug`.
3. No recorre imports, no empaqueta y no sube el directorio.

```bash
npx -y @insforge/cli functions deploy ops-sales-read \
  --file insforge/functions/ops-sales-read/index.ts
```

Ese comando **no** incluye `../_shared/sales-read/` ni `../_shared/http/origin-guard.ts`. En el runtime de Deno el import relativo queda fuera del código desplegado.

El repo ya trata el deploy como archivo único. La evidencia de checkout lo registra así: `functions deploy <slug> --file <single-file>`, y el artefacto que se despliega es `handler.deploy.js`, generado antes con esbuild. Ese es el patrón de `bundle:checkout`, `bundle:webhook`, `bundle:order-status`, `bundle:team-roster`, `bundle:ticket-credentials` y `bundle:send-ticket-email`.

## 2. Bundle

Hace falta un bundle propio. No se reutiliza ni se modifica el de `mp-create-checkout`.

| Pieza | Ruta |
|---|---|
| Entry | `insforge/functions/ops-sales-read/index.ts` |
| Script | `scripts/bundle-ops-sales-read.mjs` |
| Comando | `npm run bundle:sales-read` |
| Artefacto | `insforge/functions/ops-sales-read/handler.deploy.js` |

esbuild `0.28.1`, `--bundle --format=esm --platform=neutral --target=es2022`. El SDK queda externo (`npm:@insforge/sdk@1.5.0`). Entran en el archivo `assemble.ts`, `gate.ts` y `origin-guard.ts`. El resultado exporta `handler as default`.

Verificación: `tests/unit/sales-dashboard/sales-read-bundle.test.ts`. Regenera el bundle, comprueba que el código compartido quedó inline, que la única escritura es `insert`/`update` sobre `payment_finance_adjustments`, que no hay escritura sobre `orders`, `payments` ni `products`, que no arrastra checkout ni `MERCADOPAGO_ACCESS_TOKEN`, y que el `handler.deploy.js` de checkout no cambia de bytes.

El archivo que se despliega es el bundle, no `index.ts`:

```bash
npm run bundle:sales-read
npx -y @insforge/cli functions deploy ops-sales-read \
  --file insforge/functions/ops-sales-read/handler.deploy.js \
  --name "Sales read" \
  --description "Read-only sales dashboard snapshot"
```

## 3. Migración 0030

Archivo: `insforge/migrations/0030_dashboard-readers.sql`.

- Aditiva: `CREATE TABLE public.dashboard_readers`. No altera `orders`, `payments`, `products`, `affiliates` ni `events`.
- Independiente de `0017`. No toca `ck_operational_assignments_role`.
- Una sola vez. No usa `IF NOT EXISTS`. La segunda ejecución falla porque la tabla ya existe. No reintentar con `--all`.
- Sin `GRANT` de escritura. El `CHECK` solo admite `OWNER` y `FINANCE`.
- Sin `BEGIN`/`COMMIT`: el runner envuelve la migración.

Comando único, cuando el propietario lo autorice:

```bash
npx -y @insforge/cli db migrations up 0030_dashboard-readers.sql
```

No usar `db migrations up --all`. No usar `db migrations up --to`. `0017` sigue en el directorio y no está aplicada; cualquiera de esos dos modos puede arrastrarla.

## 4. RLS

La migración deja la tabla así:

- `ENABLE ROW LEVEL SECURITY`
- `FORCE ROW LEVEL SECURITY`
- `REVOKE ALL` a `PUBLIC`, `anon` y `authenticated`
- Ninguna policy. Sin policy, el rol de browser no lee ni escribe.
- Ningún `GRANT` sobre `orders` o `payments`.

`ops-sales-read` consulta `dashboard_readers` solo después de resolver el usuario de la sesión y solo con el cliente admin del runtime. Las vistas aceptadas son `whoami`, `snapshot` y `upsert-adjustment`. Esta última escribe únicamente `payment_finance_adjustments` (migración `0031`, tampoco aplicada). `update`, `refund`, `insert` y `patch` siguen respondiendo 403. `OWNER` y `FINANCE` pueden guardar la conciliación. El resto no.

`FINANCE` en la PWA no abre check-in ni mesa, y el cliente anónimo no tiene grant para mutar ventas. El rol de la allowlist no es un rol de escritura.

## 5. Alta de los cuatro lectores

`finance@example.com` es el correo del harness. No se inserta.

| Correo | Rol |
|---|---|
| leandro.m.espinosa@gmail.com | `OWNER` |
| robertoneill2508@gmail.com | `FINANCE` |
| valentina.et2011@gmail.com | `FINANCE` |
| silvia.tenreiro@gmail.com | `FINANCE` |

El alta de Auth no asigna el rol. Cada persona crea su contraseña en `/signup` de la PWA y verifica el código de 6 dígitos. Después se lee el `auth.users.id` real. No inventar UUIDs.

`FINANCE` no abre check-in ni mesa. Ninguno de los cuatro edita órdenes, pagos, estados, precios ni productos por estar en esta tabla.

Cuando las cuatro cuentas existan y `0030` ya esté aplicada, el insert es idempotente y no pisa un rol distinto:

```sql
INSERT INTO public.dashboard_readers (auth_user_id, role)
VALUES
  ('<id real de leandro.m.espinosa@gmail.com>', 'OWNER'),
  ('<id real de robertoneill2508@gmail.com>', 'FINANCE'),
  ('<id real de valentina.et2011@gmail.com>', 'FINANCE'),
  ('<id real de silvia.tenreiro@gmail.com>', 'FINANCE')
ON CONFLICT (auth_user_id) DO NOTHING;
```

Ese SQL no se ejecuta hasta sustituir los cuatro id. Si una fila ya existe con otro rol, no se cambia en silencio: se reporta antes.

## 6. CORS

El origen productivo de la PWA operativa es `https://ops.enforma.mx`. El navegador enviará `Origin: https://ops.enforma.mx`. La función compara ese header con un solo valor, sin comodines.

`CHECKOUT_CORS_ORIGIN` pertenece a la landing pública. No se reutiliza como origen del dashboard y no se cambia a `ops.enforma.mx`.

Valor a configurar cuando se autorice, y no antes:

```bash
npx -y @insforge/cli secrets add OPS_DASHBOARD_CORS_ORIGIN https://ops.enforma.mx
```

`https://4bg9ufz2.insforge.site` es el hosting anterior de InsForge. No es el origen productivo final. `INSFORGE_BASE_URL` y `API_KEY` los inyecta el runtime de la función. No van al frontend.

## 7. Despliegue del frontend

El frontend productivo final no es `https://4bg9ufz2.insforge.site`. Ese host queda como despliegue histórico de InsForge (último READY conocido: `7cec3591-8e3a-43f9-a6e7-9dcc4bb1210b`, 2026-07-04). No se vuelve a publicar ahí como sitio de operaciones.

La PWA se despliega en un proyecto Vercel de la organización ENFORMA, con dominio `https://ops.enforma.mx`.

- Framework: Vite
- Build: `npm run build` (`tsc -b && vite build`)
- Output: `dist`
- `vercel.json` reescribe las rutas de la SPA a `index.html`
- Variables de ese proyecto: solo `VITE_INSFORGE_URL` y `VITE_INSFORGE_ANON_KEY`
- No subir `dist/` a mano. Vercel construye desde el fuente del repo.

No ejecutar el deploy en esta preparación. El comando, cuando se autorice, es el deploy del proyecto Vercel de ENFORMA, no `insforge deployments deploy .`.

## 8. Queries de referencia

Solo `SELECT`, después del deploy, contra el mismo momento en que se mira el dashboard. No hardcodear el audit de 4 órdenes / 2 PAID.

```sql
SELECT count(*) AS paid_count
FROM public.orders
WHERE state = 'PAID';

SELECT coalesce(sum(total_cents), 0) AS revenue_cents
FROM public.orders
WHERE state = 'PAID';

SELECT state, count(*) AS n
FROM public.orders
WHERE state IN ('PREFERENCE_PENDING', 'PAYMENT_PENDING', 'REJECTED')
GROUP BY state
ORDER BY state;

SELECT p.provider_updated_at, p.provider, p.provider_payment_id, o.total_cents
FROM public.payments p
JOIN public.orders o ON o.id = p.order_id
WHERE p.normalized_state = 'APPROVED'
  AND o.state = 'PAID'
ORDER BY p.provider_updated_at DESC NULLS LAST
LIMIT 1;

SELECT coalesce(sum(oi.quantity * pr.team_size), 0) AS participants
FROM public.orders o
JOIN public.order_items oi ON oi.order_id = o.id
JOIN public.products pr ON pr.code = oi.product_code
WHERE o.state = 'PAID';

SELECT provider, normalized_state, count(*) AS n,
       coalesce(sum(amount_cents), 0) AS amount_cents
FROM public.payments
GROUP BY provider, normalized_state
ORDER BY provider, normalized_state;
```

El revenue del dashboard es `orders.total_cents` de las PAID. `payments.amount_cents` es la conciliación, no un segundo KPI. La última venta usa `provider_updated_at` del pago `APPROVED` de una orden `PAID`. Los filtros de fecha del dashboard recortan estas cifras; para comparar el total, el filtro de la UI tiene que cubrir todo el histórico (rango desde la primera orden).

## 9. Smoke test

Login individual en `https://ops.enforma.mx`.

Leandro (`OWNER`): Ventas visible, el dashboard carga, una conciliación de prueba guarda su identidad, y siguen sus capacidades de OWNER.

Roberto, Valentina y Silvia (`FINANCE`): el banner muestra su correo y `· FINANCE`.

Menú visible: Inicio, Ventas, Cerrar sesión.  
Menú ausente: Check-in, Mesa.

| Ruta | Resultado |
|---|---|
| `/ops/finance` | Render del dashboard |
| `/ops/checkin` | Acceso denegado |
| `/ops/desk` | Acceso denegado |

En el rango que cubre todo el histórico, comparar con las queries:

- ventas aprobadas = `paid_count`
- ingresos = `revenue_cents` en MXN
- pendientes = `PREFERENCE_PENDING` + `PAYMENT_PENDING`, con el mismo desglose
- ticket promedio = ingresos / ventas
- participantes = la suma `quantity * team_size`
- última venta = el `provider_updated_at` de la query

Después: un filtro de 7 días, una búsqueda por tracking o payment id, abrir un detalle, y exportar CSV. El CSV debe traer solo las filas del filtro activo.

## 10. Prueba de mutación

Con la sesión FINANCE ya abierta. Tiene que fallar el servidor, no solo faltar el botón.

1. `POST` a `ops-sales-read` con cuerpo `{ "view": "update" }`, y otra vez con `"refund"`. Respuesta 403 `FORBIDDEN`.
2. Desde el cliente anónimo de la sesión, `update` de `orders.state`, `update` de `payments` y `update` de `products`. Postgres debe negar el privilegio o el RLS. No debe haber fila cambiada.
3. Abrir `/ops/checkin` y `/ops/desk`. Acceso denegado.
4. Repetir el `SELECT count(*)` de PAID y la suma de `total_cents`. Tienen que ser los mismos números de antes de la prueba.

## 11. Rollback

No borra órdenes, pagos, boletos, checkout ni Mercado Pago.

1. Quitar el acceso, sustituyendo el id real:

```sql
DELETE FROM public.dashboard_readers
WHERE auth_user_id = '<auth.users.id>'
  AND role = 'FINANCE';
```

Sin esa fila la función responde 403. La tabla puede quedarse.

2. Retirar la función:

```bash
npx -y @insforge/cli functions delete ops-sales-read
```

3. Volver la PWA al deployment anterior dentro del proyecto Vercel de ENFORMA. No republicar `https://4bg9ufz2.insforge.site` como sitio de operaciones. Anotar el id del deployment nuevo antes de darlo por bueno.

`OPS_DASHBOARD_CORS_ORIGIN` puede quedar. No abre datos por sí solo.

## 12. Comandos, en orden

Local, ya disponible:

```bash
npm run bundle:sales-read
npx vitest run tests/unit/sales-dashboard/sales-read-bundle.test.ts
npm run typecheck
npm test
npm run build
```

Producción, solo con autorización explícita, en este orden:

1. Preparar el proyecto Vercel en la organización ENFORMA. No desplegar todavía el alias final si el dominio no está listo.
2. Configurar en ese proyecto solo `VITE_INSFORGE_URL` y `VITE_INSFORGE_ANON_KEY`.
3. Conectar el dominio `ops.enforma.mx`. El DNS no se toca hasta esa autorización.
4. `npx -y @insforge/cli db migrations up 0030_dashboard-readers.sql`
5. `npx -y @insforge/cli db migrations up 0031_payment-finance-adjustments.sql`
6. Cada persona crea y verifica su cuenta en `/signup`. El frontend tiene que ser alcanzable antes de este paso. Luego leer los cuatro `id` reales.
7. Insertar `dashboard_readers` con esos id. `ON CONFLICT DO NOTHING`.
8. `npx -y @insforge/cli secrets add OPS_DASHBOARD_CORS_ORIGIN https://ops.enforma.mx`
9. `npm run bundle:sales-read` y desplegar `insforge/functions/ops-sales-read/handler.deploy.js`
10. Desplegar la PWA en el proyecto Vercel de ENFORMA.
11. Verificar DNS y HTTPS de `https://ops.enforma.mx`.
12. Login de los cuatro usuarios.
13. Smoke de OWNER y de cada FINANCE.
14. Una conciliación de prueba controlada, con nota de que es prueba.
15. GO solo si los pasos anteriores cierran.

No usar `db migrations up --all`. No usar `--to`. No usar `insforge deployments deploy .` como frontend productivo.

## GO / NO-GO

| Prerrequisito | Estado |
|---|---|
| El CLI no empaqueta `../_shared`; el deploy de `index.ts` solo no sirve | Cerrado. Hace falta el bundle |
| `handler.deploy.js` de sales-read generado y cubierto por test | Cerrado en el árbol local |
| Bundle de checkout intacto | Cerrado |
| `0030` revisada, aditiva, un solo archivo | Cerrado como archivo. No aplicada |
| `0031_payment-finance-adjustments.sql` | Escrita. No aplicada. Va después de `0030`, nunca con `--all` |
| Comandos de migración, uno por archivo: `0030` y luego `0031` | Cerrado. Prohibido `--all` y `--to` |
| RLS de `dashboard_readers` sin acceso browser | Cerrado en el SQL. No aplicado |
| Cuatro correos aprobados | Cerrado como mapeo. Las cuentas de Auth todavía no existen |
| `OPS_DASHBOARD_CORS_ORIGIN` = `https://ops.enforma.mx` | Abierto. No crear el secreto todavía |
| `CHECKOUT_CORS_ORIGIN` sigue siendo el de la landing, no el de ops | No cambiarlo en este trabajo |
| Función desplegada desde `handler.deploy.js` | No desplegada |
| PWA en Vercel ENFORMA, dominio `ops.enforma.mx` | No desplegada. `4bg9ufz2.insforge.site` no es el destino |
| `vercel.json` para que `/login`, `/signup`, `/verify-email` y `/ops/*` recarguen | Cerrado en el árbol local |
| Queries, smoke, mutación y rollback escritos | Cerrado. No ejecutados |

**NO-GO.** Falta aplicar `0030` y después `0031` por separado, que las cuatro personas creen su cuenta, insertar `dashboard_readers` con id reales, el secreto `https://ops.enforma.mx`, el deploy de la función desde el bundle, el proyecto Vercel de ENFORMA y el dominio.
