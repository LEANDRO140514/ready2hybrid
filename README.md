# ready2hybrid

Sistema operativo de **Hybrid Experience** (Mérida, 13–15 de noviembre de 2026). Este repositorio es el backend en InsForge y la PWA de staff. La landing pública vive en otro repositorio y se publica en `https://hybrid-experience.enforma.mx/`.

## 1. Propósito

Cobrar inscripciones, emitir el boleto y dar al equipo de ENFORMA una vista de ventas y conciliación. El cupo no limita la venta. El precio cambia por fecha, no por unidades vendidas.

## 2. Arquitectura

| Superficie | Dónde | Qué hace |
|---|---|---|
| Pública | `https://hybrid-experience.enforma.mx/` | Landing, catálogo y checkout |
| Operaciones | `https://ops.enforma.mx` | PWA de staff en Vercel, organización ENFORMA |
| Backend | InsForge `ready2hybrid` | Auth, base de datos, edge functions, API del dashboard |
| Pagos | Mercado Pago Checkout Pro | Cobro. Clip y Openpay no están activos |

`https://4bg9ufz2.insforge.site` es un hosting anterior de la PWA. No es el sitio productivo final. El API sigue en `https://4bg9ufz2.us-east.insforge.app`.

## 3. Componentes

- `src/`: PWA React.
- `insforge/functions/`: edge functions. El archivo que se despliega es `handler.deploy.js`, generado con `npm run bundle:*`.
- `insforge/migrations/`: SQL aplicable, un archivo a la vez.
- `docs/MANUAL_OPERATIVO.md`: uso del dashboard para Owner, Financiero, CEO y CTO.
- `docs/LANDING_OPERATIONS.md`: operación de la landing.
- `docs/FINANCE_DASHBOARD_DEPLOYMENT.md`: plan de salida. Estado **NO-GO** hasta ejecutarlo con autorización.

## 4. Frontend PWA

Vite + React 19 + TypeScript. Enrutador del navegador (TanStack Router). Recargar `/login`, `/signup`, `/verify-email`, `/ops/finance`, `/ops/checkin` o `/ops/desk` depende de `vercel.json`, que reescribe esas rutas a `index.html`. Los archivos que sí existen (`assets`, service worker, iconos) los sirve el hosting antes del rewrite.

Build: `npm run build` (`tsc -b` y después `vite build`). Salida: `dist/`.

No hace falta cambiar la arquitectura para publicarla en Vercel. El proyecto debe ser de la organización ENFORMA, con dominio `ops.enforma.mx` en la raíz del sitio.

## 5. InsForge

Proyecto `ready2hybrid`. La PWA habla con el API usando la URL pública y la anon key. Las functions de staff usan la sesión del usuario. `ops-sales-read` lee ventas y escribe solo la conciliación financiera.

## 6. Auth

Alta en `/signup`. Cada persona elige su contraseña. InsForge exige verificación por código de 6 dígitos (`requireEmailVerification`, método `code`). `/verify-email` llama a `verifyEmail`. Después se entra por `/login`.

El formulario no asigna rol y no acepta `?role=`. Quien entra sin fila en `dashboard_readers` ve Inicio y «sin rol operativo».

La sesión del SDK manda `credentials: include` al API. El token de acceso queda en memoria. La cookie CSRF la escribe el navegador en el host de la PWA (`SameSite=Lax`). El refresh lo resuelve el API. En el primer login real de `https://ops.enforma.mx` hay que confirmar que recargar la página conserva la sesión. Si no la conserva, el ajuste es de Auth en InsForge (origen con credenciales), no un secreto en el frontend.

Este flujo no usa `redirectTo`. `allowed_redirect_urls` no hace falta mientras la verificación siga siendo por código. Si algún día pasa a enlace, hay que permitir `https://ops.enforma.mx/login` con `config export`, `config plan` y `config apply`. No cambiarlo ahora.

Google y GitHub están disponibles en el backend. Esta PWA no los usa. No hay callback nuevo que registrar para el login con contraseña.

Para cerrar altas públicas después del onboarding: `auth.disable_signup = true` en `insforge.toml` y `config apply`. No desactivarlo antes de que existan las cuatro cuentas.

## 7. Órdenes

Una venta del dashboard es una orden en estado `PAID`. El bruto es `orders.total_cents`. El id de pago que se muestra es `payments.provider_payment_id`. La fecha de aprobación es `payments.provider_updated_at` del pago `APPROVED`.

## 8. Mercado Pago

Checkout Pro. El webhook y la emisión del boleto viven en functions de InsForge. El frontend operativo no lleva access token ni secreto de webhook.

## 9. Tickets

El boleto y el QR se emiten en el backend cuando el pago queda aplicado. El correo del boleto depende de `EMAIL_PROVIDER` y sigue diferido como bloqueo de go-live de ventas. El dashboard no edita boletos.

## 10. Dashboard financiero

Ruta `/ops/finance`. La leen `OWNER` y `FINANCE`. La function `ops-sales-read` responde `whoami`, `snapshot` y `upsert-adjustment`. Cualquier otra vista responde 403.

## 11. Conciliación financiera

Tabla aparte `payment_finance_adjustments` (migración `0031`, no aplicada). No modifica órdenes, pagos, estados, precios ni Mercado Pago. El neto no se guarda: es bruto menos los tres costos capturados. Una fila `0 / 0 / 0` está conciliada. Una venta sin fila no es costo cero.

## 12. Roles

| Rol | Menú | Conciliación | Check-in y mesa |
|---|---|---|---|
| `OWNER` | Inicio, Ventas y lo operativo que ya tenía | Sí | Sí |
| `FINANCE` | Inicio y Ventas | Sí | No |
| Sin fila en `dashboard_readers` | Inicio | No | No |

Correos previstos: Leandro `OWNER`; Roberto, Valentina y Silvia `FINANCE`. Los id se insertan después de que cada cuenta exista. Ver `docs/FINANCE_DASHBOARD_DEPLOYMENT.md`.

## 13. Desarrollo local

```bash
npm install
npm run dev
```

Copia `.env.example` a `.env.local` (no se versiona) y completa la URL del API y la anon key. `npm run dev -- --mode e2e` usa fixtures y no debe usarse como producción.

## 14. Tests

```bash
npm test
npm run typecheck
npm run test:e2e
```

`test:e2e` levanta el harness en el puerto 4173. No crea usuarios reales.

## 15. Variables de entorno

Públicas, en el proyecto Vercel de la PWA:

| Variable | Uso |
|---|---|
| `VITE_INSFORGE_URL` | API `https://4bg9ufz2.us-east.insforge.app` |
| `VITE_INSFORGE_ANON_KEY` | Clave anónima de navegador. No es la API key de admin |
| `VITE_SHELL_BUILD_ID` | Opcional. Marca de build. No otorga acceso |

Prohibidas en el frontend: `API_KEY`, service key, `MERCADOPAGO_ACCESS_TOKEN`, secreto de webhook, y cualquier secreto de InsForge.

Secreto de function, solo en InsForge, cuando se autorice:

`OPS_DASHBOARD_CORS_ORIGIN=https://ops.enforma.mx`

`CHECKOUT_CORS_ORIGIN` sigue siendo el origen de la landing. No apuntarlo a `ops.enforma.mx`.

`VITE_AUTH_MODE=fixture` hace fallar el build de producción.

## 16. Build

```bash
npm run typecheck
npm test
npm run build
```

La salida es `dist/`. Vercel ejecuta el build. No se publica una carpeta `dist` armada a mano.

## 17. Deploy del frontend a Vercel

No ejecutado. Cuando se autorice:

1. Proyecto Vercel en la organización ENFORMA, raíz de este repo.
2. Framework Vite. Build `npm run build`. Output `dist`.
3. Variables de la sección 15.
4. Dominio `ops.enforma.mx` en la raíz.
5. Confirmar que recargar `/ops/finance` no responde 404.

No usar `npx -y @insforge/cli deployments deploy .` como publicación productiva de esta PWA.

## 18. Deploy de functions

Regenerar el bundle en el repo, commitear ese archivo y desplegar ese archivo. `ops-sales-read` se despliega desde `insforge/functions/ops-sales-read/handler.deploy.js` después de `npm run bundle:sales-read`. El CLI sube un solo archivo: desplegar `index.ts` deja fuera el código compartido.

## 19. Migraciones

Un archivo por comando.

```bash
npx -y @insforge/cli db migrations up 0030_dashboard-readers.sql
npx -y @insforge/cli db migrations up 0031_payment-finance-adjustments.sql
```

No usar `db migrations up --all`. No usar `--to` mientras `0017` siga sin aplicar en Main: esos modos pueden arrastrarla. `0021` está bloqueada. `0018` no se aplica.

`0030` y `0031` no están aplicadas. No forman parte de esta preparación documental.

## 20. Rollback

Quitar la fila de `dashboard_readers` cierra el dashboard para esa persona. Borrar la function `ops-sales-read` apaga la API. La PWA se revierte al deployment anterior del proyecto Vercel de ENFORMA. No se republica `4bg9ufz2.insforge.site` como sitio de operaciones. Nada de eso borra órdenes, pagos ni boletos.

## 21. Seguridad

El repositorio es público. No commitear `.env.local`, `.insforge/`, tokens ni la anon key en documentación. El QR lleva identificadores opacos. El rol del dashboard sale de `dashboard_readers` en el servidor.

## 22. Troubleshooting

| Síntoma | Qué revisar |
|---|---|
| 404 al recargar `/ops/finance` | `vercel.json` no está en el deployment |
| Dashboard en blanco o 403 de origen | `OPS_DASHBOARD_CORS_ORIGIN` distinto de `https://ops.enforma.mx` |
| Login correcto y sin Ventas | Falta la fila en `dashboard_readers`, o `0030` no está aplicada |
| El código de alta no llega | Verificación de email de InsForge, no un correo armado por esta PWA |
| La sesión se pierde al recargar | Cookie de refresh del API frente al origen `ops.enforma.mx` |
| Checkout de la landing falla de origen | No cambiar `CHECKOUT_CORS_ORIGIN` al dominio ops |
