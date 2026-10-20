# innoapp-web-user-client

Dashboard React/Vite de InnoApp. Usa Cognito para iniciar sesión y la API
real para tickets, widgets, robots, códigos de activación y datos agregados
de Athena. Las lecturas se refrescan cada 30 segundos mientras la pestaña está visible.

## Sesiones y métricas

El árbol autenticado se reinicia al cambiar de tenant o usuario. Las operaciones
pendientes de otra identidad se invalidan; renovar el JWT de la misma cuenta
conserva su conversación y sus mutaciones. Login, logout y renovación también
se coordinan entre pestañas.

Las preguntas sobre cifras se envían al backend; el navegador no responde con
la muestra de tickets recientes. Las métricas de venta consultan tickets
confirmados por defecto. Los KPIs usan exclusivamente su resultado de servidor:
un error conserva el último resultado con un aviso y fecha; un valor ausente
se muestra como «Sin datos», conservando los ceros observados.

Los promedios temporales se reagrupan usando `sampleCount` de la API. Una
respuesta antigua sin pesos no genera un promedio semanal/mensual de promedios.
Los informes y CSV también conservan la ausencia de datos y los decimales.

Para desarrollo y pruebas se usa Node.js 24:

```bash
npm test
npm run lint
npm run build
```

Las pruebas usan `node:test` y el compilador TypeScript instalado, sin un
framework adicional. Incluyen carreras de sesión, cancelación de exportaciones,
promedios ponderados y estados de KPI.

Estos cambios requieren publicar primero el backend actualizado (contrato
`value: number | null`, `sampleCount` opcional) y después la web.

## Configuración

Copiar `.env.example` a `.env` y completar los outputs del stack CDK:

```env
VITE_COGNITO_CLIENT_ID=...
VITE_COGNITO_REGION=us-east-1
VITE_API_BASE_URL=https://...execute-api.../prod
VITE_AGENT_DOWNLOAD_URL=/downloads/InnoAppAgent-Setup.exe
VITE_AGENT_VERSION=0.1.0-pilot
```

`VITE_AGENT_DOWNLOAD_URL` habilita el botÃ³n de descarga dentro de la pestaÃ±a
Agentes. El instalador es universal; cada instalaciÃ³n queda vinculada al
tenant mediante uno de los cÃ³digos de activaciÃ³n de un solo uso mostrados en
la misma pantalla.

`npm run dev` arranca el entorno local; `npm run build` valida TypeScript y
genera el bundle de producción.

## Base técnica

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
