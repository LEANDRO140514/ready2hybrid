# Login

Overrides `MASTER.md` for the sign-in screen only.

## Purpose

The first screen at `https://ops.enforma.mx` is the ENFORMA entrance for HYBRID EVENT EXPERIENCE 2026. It is not a blue SaaS template.

## Content

1. ENFORMA
2. HYBRID EVENT EXPERIENCE 2026
3. Control de ventas y conciliación financiera.
4. Correo
5. Contraseña
6. Entrar. Brand-lime fill, black text. Not blue, not success green.
7. Crear cuenta, text link, only while public signup is open. When signup is closed, this link is absent.

## Color

Page is `brand-black`. The card is the neutral surface, not a pink panel. Brand-pink may mark one short accent, not the form. Labels and inputs stay white on the dark surface.

## Do not show

Shell, PWA, build id, manifiesto, deployment notes, or a role picker.

## Behavior

One column, max width 28rem, on the page background. Labels stay visible. Errors sit above the button and do not clear the password until the user edits it. Entrar is disabled while the request is in flight. The form allows paste and a password manager.

## Responsive

Same stack at 375px. Inputs and Entrar are full width and at least 44px tall.
