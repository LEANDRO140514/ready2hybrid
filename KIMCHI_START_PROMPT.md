# Prompt inicial para Kimchi

Estás trabajando en Ready2Hybrid.

Lee primero `WORKSPACE_STATUS.md` y después todos los archivos de `docs/` en
orden numérico. Si existe contradicción, manda el documento de número menor.

Decisiones cerradas:
- Kimchi es el constructor principal.
- Vite + React 19 + TypeScript strict; no Next.js.
- Ready2Hybrid es una PWA offline-first.
- InsForge es la fuente de verdad de registros, pagos, tickets, QR, check-ins,
  sincronización, resultados y auditoría.
- Mercado Pago Checkout Pro es la pasarela.
- El evento es viernes 9 de octubre de 2026.

Primera tarea: PREFLIGHT de solo lectura.
1. Confirma ruta, Git, HEAD y working tree.
2. Verifica Node/npm, TypeScript y herramientas de prueba.
3. Lista y prueba en modo lectura el MCP de InsForge; identifica el proyecto.
4. Lista y prueba en modo lectura el MCP de Mercado Pago; confirma acceso a la
   documentación de Checkout Pro México y herramientas de webhook.
5. No ejecutes SQL, no crees tablas, no instales dependencias, no modifiques
   archivos, no muestres secretos y no actúes en producción.
6. Entrega una matriz PASS/FAIL, bloqueadores y el plan exacto de F0.
7. Detente para aprobación.
