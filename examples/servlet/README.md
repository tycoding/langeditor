# JSP / Servlet

The editor is a browser component, so a Servlet application only needs to serve the generated element bundle from its static assets directory. No Vue runtime or JavaScript framework is required in the JSP page.

Copy `lib/langeditor-element.es.js` to the application's `/assets` directory after running `pnpm build:element`.
DOCX import/export is optional: build `@langeditor/plugin-docx` and copy its
`dist/index.es.js` plus the generated `dist/chunks/` files as
`/assets/langeditor-plugin-docx.es.js` and `/assets/chunks/`.

For production AI requests, point the editor's OpenAI-compatible completion adapter at a server endpoint such as `/api/ai/chat/completions`. The Servlet should authenticate the user, call the model provider, and stream `text/event-stream` responses back to the browser. Keep provider API keys on the server.

The browser-side event contract remains the same as the other adapters:

- `lc-ready`: the editor mounted.
- `lc-input`: the current value changed.
- `lc-change`: the current output and format.
- `lc-error`: mounting or editor error.
