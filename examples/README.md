# Cross-framework examples

These examples all use the same `@langeditor/core/element` Web Component. The editor UI, AI menu, Tiptap extensions, and styles are still implemented once in the main package.

Each example intentionally enables the complete extension surface, including the top menubar, full toolbar, source-code dialog, AI actions, tables, media, import/export, and document tools. The editor is configured with a large viewport so every integration can be exercised without changing its host framework.

## Examples

- `composer/`: public Vue Composer layout with unified context, Mention, actions, submit, and mock dictation.
- `plugins/`: distributable Tiptap plugin and external document-surface registration examples.
- `vanilla/`: native browser JavaScript with DOM properties and CustomEvents.
- `react/`: a React app using the thin `@langeditor/react` adapter.
- `svelte/`: a Svelte app consuming the Web Component directly.
- `servlet/`: a JSP/Servlet-rendered page that loads the browser bundle and points AI requests at a server proxy.

Angular, Preact, Solid, and other custom-element-compatible frameworks use the same direct Web Component path as the Svelte example; only React has a dedicated package because its prop/event ergonomics benefit from a thin adapter.

The examples assume the packages are installed from npm. When developing from this repository, build the element bundle first with `pnpm build:element`.
