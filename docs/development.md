# LangEditor Development Rules

This document is the development guide for contributors working
on LangEditor. It applies to the editor core, public extensions, commercial
plugin packages, the Web Component adapter, framework adapters, and Playground
examples.

The product is an AI-first editor. A change is complete only when it preserves the
editing model, keeps the AI workflow coherent, and remains usable in the supported
embedding modes. Do not optimize for a single screenshot or a single framework at
the expense of the shared editor contract.

## Non-negotiable rules

- Read the surrounding component, extension, and public type before editing it.
- Keep changes scoped to the requested behavior. Do not reformat unrelated files or
  revert work that belongs to another contributor.
- Do not introduce a second editor implementation for React, Web Components, or
  commercial features. Adapters and plugins must reuse the core editor.
- Do not share mutable Tiptap extension instances between editor instances. Create
  extensions inside the plugin create() lifecycle.
- Visible copy, tooltips, labels, errors, and accessibility text must come from
  src/locales; never hardcode user-facing language in a Vue template or plugin.
- Every interactive control needs stable disabled, hover, focus, active, and
  keyboard-accessible states. Do not use color alone to communicate state.
- Prefer existing components, tokens, icons, hooks, and extension APIs over new
  one-off abstractions.
- Never add a dependency to the core bundle for a feature that can be asynchronous
  or plugin-provided. Mini mode must remain free of DOCX, chart, and code-editor
  runtime imports until those features are actually used.

## Repository map

    src/
      components/       Shared Vue UI grouped by responsibility; no root-level Vue files
      components/editor/ LangEditor host shell and structural subcomponents
      components/actions/ Shared toolbar/menu action controls
      components/toolbar/ Default and Word toolbar composition
      components/menubar/ Menubar composition and structured menu pickers
      components/menus/ Selection, bubble, content, and AI menus
      components/document/ Word document chrome, comments, and page-region UI
      components/navigation/ TOC and editor navigation UI
      components/overlays/ Dialogs, preview, printing, source, and search surfaces
      components/plugins/ Plugin UI slots and resize handles
      components/theme/ Theme controls
      components/ui/    Reusable primitive controls (button, menu, tooltip, etc.)
      extensions/       One Tiptap extension or node per capability
      plugins/          Editor runtime plugins and low-level ProseMirror behavior
      element/          Framework-neutral Web Component and CustomEvent adapter
      locales/          Chinese and English translation dictionaries
      styles/           Theme tokens, ProseMirror/document styles, and small semantic CSS
      hooks/            Shared editor/theme/portal state
    packages/
      editor-react/     Thin React wrapper; never duplicate editor behavior or UI
    commercial/         Ignored, separately versioned commercial workspace
      apps/playground/  Private product site, docs UI, and integration scenarios
      apps/             Other deployable commercial servers, workers, and CLIs
      packages/         Commercial NPM capability packages
    examples/           Minimal vanilla, React, Svelte, Servlet, and plugin examples
    vite*.config.ts    Library, Mini, and Web Component build entry points

src/index.ts is the Vue-oriented main entry. src/mini.ts is the lightweight
entry. src/element/index.ts is the framework-neutral entry. Keep exports and
type declarations synchronized when adding public APIs.

New shared components must go into the narrowest existing responsibility folder.
Do not restore a flat `src/components/*.vue` catalog. Large host behavior belongs
in a focused hook or structural child component; `LangEditor.vue` should compose
the editor lifecycle and layout rather than own every document workflow inline.

## Extension and plugin architecture

### Public extensions

An extension belongs in src/extensions/<Capability>/ and should normally contain
the extension definition, its options/types, and optional components or NodeViews.
Export it from src/extensions/index.ts and use the existing extension option
patterns. A node or mark must have a unique name, explicit parse/render behavior,
and a documented JSON/HTML contract.

NodeViews must follow Tiptap's ownership rules:

- Vue NodeViews must render through NodeViewWrapper (and NodeViewContent when
  content is editable).
- Do not replace or mutate ProseMirror-managed DOM behind its back.
- Keep asynchronous editor runtimes behind a stable synchronous NodeView wrapper.
- Use atom: true only when the node owns its complete content and selection model.
- Dispatch document changes through commands or transactions; do not mutate node
  attributes or the DOM directly.

### Distributable plugins

Every independently installable capability is one NPM package, public or
commercial. Public plugins use `packages/editor-plugin-<id>/`; commercial plugins
use `commercial/packages/editor-plugin-<id>/`. The package source shape is:

    <package-root>/editor-plugin-<id>/
      package.json
      README.md                 purpose, PRD, installation, License, UI behavior
      src/
        index.ts                side-effect registration entry
        manifest.ts             id, version, core range, requires/conflicts/features
        plugin.ts               registerEditorPlugin() definition
        extensions/             Tiptap nodes, marks, and extensions
        components/             toolbar, bubble, sidebar, statusbar components
        ai/                     AI actions, stream/event adapters, and tools
        serializers/             optional import/export adapters
        styles/index.css        only complex/plugin-specific semantic CSS
      examples/                 minimal Vue, React, and Web Component usage

The package must:

- use a globally unique plugin ID and namespaced node/extension names;
- declare @langeditor/core and shared Tiptap packages as peer dependencies when
  appropriate;
- declare requires, conflicts, licenseFeature, and supported core ranges;
- register by side effect after the package is explicitly imported;
- expose a per-editor create({ editor, options, license }) lifecycle;
- avoid redefining or silently replacing a core node; use an enhancement/contribution
  or a namespaced node instead;
- keep commercial source under `commercial/`, follow `commercial/AGENTS.md`, and
  maintain it in the private canonical repository. An ignored local folder is not
  a backup or a source-of-truth.

Commercial plugins are capability packages, not a second editor. License checks
may hide registration or UI, but must not duplicate the core editing model. The
plugin README/PRD is required before implementation and must describe its boundary,
license feature, UI placement, AI behavior, and failure states.

The full public/commercial ownership and dependency model is documented in
[`ARCHITECTURE.md`](../ARCHITECTURE.md). Public source must never import files from `commercial/`.

Plugins that own synchronized document content must declare the per-editor
`document` contribution instead of relying on a hardcoded extension or storage
name. Use the public `lc-document-sync` DOM event for provider-neutral sync state;
framework adapters and the editor host must not listen for a commercial plugin's
private event namespace.

## UI placement contract

Use the smallest appropriate contribution. A single action belongs in an existing
extension button; compound workflows use a plugin UI slot.

| Placement | Use for | Rules |
| --- | --- | --- |
| menubar | Structured menus or top-level workflows | Use existing menu primitives; keep labels localized. |
| toolbar | Compound tools, panel toggles, plugin actions | Do not add a second toolbar row. Follow existing group and overflow behavior. |
| bubble | Selection-scoped actions | React to selection changes; do not render a permanent floating button. |
| sidebar-left | Navigation, outline, document context | Treat it as an editor rail and support the shared resize handle when enabled. |
| sidebar-right | AI results, comments, review, business context | It must release its width when closed and remain independently scrollable. |
| statusbar-left | Word count, sync, permission state | Keep content compact and non-interactive unless necessary. |
| statusbar-right | Mode switches and secondary actions | Avoid duplicating collaboration presence or toolbar actions. |
| floating | Toasts, anchored pickers, assistant overlays | It must not block editing or create an unexplained empty region. |

### Toolbar and menu behavior

- Reuse Toolbar, Menubars, ActionButton, dropdown, tooltip, and icon primitives
  before creating a custom control.
- Use Lucide/project icons. A commercial AI action should have a compact icon and
  tooltip; do not put long product names inside narrow toolbar buttons.
- Keep one visual toolbar row. When space is constrained, collapse whole groups
  into an existing group menu or overflow affordance; never create horizontal page
  scrolling or a surprise second row.
- Preserve the order and grouping of core actions. Commercial actions appear in a
  distinct final group only when the host protocol says so.
- A menu trigger must not contain another interactive button. Use as-child for
  primitive triggers where the component library supports it.
- Tooltips describe unfamiliar icon-only controls. They are not a substitute for
  accessible labels or localized visible copy.

### Chat and AI UI

AI sidebars and bubbles are conversation surfaces, not status dashboards. They must
provide a message list, a compact composer, attachment/mention affordances when
supported, and clear streaming/thinking/error states. Reuse the existing AI message,
composer, and think/loading patterns where possible.

AI integrations must expose a framework-neutral event lifecycle. At minimum support
start, delta, complete, error, abort, accept, reject, insert, and regenerate where
the feature has those states. Stream deltas must never be written as ordinary
unlocalized status text. Keep model credentials and server-only authorization out
of the browser package.

## Styling contract

### Tailwind first, semantic CSS when justified

Use Tailwind utilities in Vue templates for local layout, spacing, typography,
colors, responsive behavior, and ordinary interactive states. This keeps styles
near the component and makes responsive changes explicit.

Use a small semantic class only when the selector cannot be expressed reliably with
utilities or when it represents a stable domain concept. Valid cases include:

- ProseMirror/Tiptap content rules and document/page layout;
- native control pseudo-elements such as range tracks and thumbs;
- third-party DOM contracts or library-generated markup;
- a repeated, cross-component state recipe that would otherwise duplicate a large
  selector block.

Semantic CSS must be scoped, token-driven, and short. Do not create a large global
class catalog, mirror every Tailwind utility as lc-*, or add a component style
block for a one-off margin. Before adding a class, check whether an existing token,
primitive, variant, or utility already solves the problem.

### Tokens and visual states

- Use the existing semantic tokens: background, foreground, muted, border, accent,
  primary, ring, destructive, and their foreground variants.
- Do not hardcode a new color for a normal surface. Add or reuse a token instead.
- Normal surfaces use close neutral layers and hairline borders. Avoid heavy shadows,
  saturated fills, and border-heavy cards.
- Every button/control defines rest, hover, focus-visible, active/selected, and
  disabled states without changing its geometry.
- Use focus-visible rings for keyboard users. Keep hover feedback subtle and do not
  rely on hover for information needed on touch devices.
- Support dark mode through tokens or the existing dark class; do not invert the
  light palette mechanically.
- Keep radii consistent with the shared primitives. Do not add a new radius scale
  inside a plugin.

### Responsive behavior

Design from the narrowest supported editor width. Toolbars wrap or collapse by
semantic group; sidebars have min/max widths and release their layout space when
closed; document surfaces use stable dimensions. Never solve overflow with a hidden
horizontal scrollbar. Verify long translations and narrow layouts before shipping.

## Internationalization and accessibility

- Add every user-facing string to both src/locales/locales/zh.ts and
  src/locales/locales/en.ts, then access it through useLocale()/t().
- Do not concatenate untranslated labels in templates. Use locale interpolation for
  counts, names, and dynamic values.
- Give icon-only controls an accessible localized aria-label; use aria-pressed
  for toggles and expose disabled state through the actual disabled attribute.
- Preserve keyboard operation for menus, dialogs, sliders, editor focus, and AI
  composer submission. Do not make a mouse-only interaction the only path.
- Respect reduced-motion preferences for non-essential animation.

## Framework and DOM protocol

The Web Component is the compatibility boundary for native JS, React, Svelte,
Angular, JSP/Servlet, and other hosts. Keep the protocol typed and framework-neutral:

- pass complex configuration through DOM properties, not stringified attributes;
- emit lc-ready, lc-input, lc-change, lc-enter, lc-error, and lc-ai with stable
  detail shapes;
- keep AI event types aligned across Vue, Web Component, and React wrappers;
- keep React changes a thin props/ref/event mapping, never a copied editor feature;
- update declarations, examples, and README when a public prop, event, or extension
  option changes.

## Performance and loading

- Keep the main and Mini entry points explicit. Do not import Word/DOCX, chart, code
  editor, or other heavy runtime modules from a Mini-only path.
- Use defineAsyncComponent or dynamic imports for panels and node runtimes that are
  not needed on first paint.
- Avoid registering optional extensions merely to render a toolbar label. A feature
  is enabled only when its extension/plugin is present.
- Do not add a dependency for a small helper already available in the project.
- When changing imports or entry points, inspect the generated chunk graph or build
  output instead of assuming tree-shaking worked.

## Word and document-mode rules

Word mode is a document surface composed of wordPage containers and page-internal
block nodes. wordPage is a layout/page boundary, not the editable block target.
Block menus, drag handles, selection actions, and AI context should target the page's
direct paragraph, heading, list, table, chart, or code-block children. A visual line
wrapped inside a paragraph is not a separate ProseMirror block.

Keep page layout, headers/footers, comments, zoom, and preview state isolated from
ordinary mode. Do not use click handlers to relocate the ProseMirror selection when
native editor selection can handle the interaction. Use transactions and mapped
positions when document changes move comments or block actions.

Document import/export must preserve the editor's JSON/HTML semantics. Unsupported
nodes need an explicit fallback or diagnostic; never silently emit an empty block.
DOCX-specific dependencies belong behind the document feature boundary and must not
leak into Mini's initial bundle.

## Verification workflow

Before editing, identify the affected entry point, extension, UI slot, locale keys,
and public types. After editing:

1. Run pnpm type:check for TypeScript and Vue template contracts.
2. Run pnpm lint for source-level consistency.
3. Run git diff --check for whitespace errors.
4. Run the smallest relevant public build (`pnpm build:lib` or
   `pnpm build:element`) when entry points, styles, or package exports changed.
5. Add or update a public example for user-visible editor behavior. Maintainers
   with the private workspace also update its Playground scenario separately.
6. Use browser/manual visual verification only when the task requires judging layout
   or interaction; record the tested mode and viewport.

Do not create tests solely to increase coverage for a CSS or copy change. Add a
focused regression test when changing shared document transforms, event protocols,
serialization, licensing, or other high-blast-radius behavior.

## Documentation and delivery checklist

- New plugins start with a README.md/PRD in their package root.
- Public API changes update README, declarations, and a minimal example.
- Commercial packages document their License feature and failure/expired states;
  commercial source is not committed to the public repository.
- Keep examples small and runnable; do not use Playground-only imports in package
  code.
- Use Conventional Commits and keep one behavioral topic per commit.
- In the final change summary, state what changed, what was intentionally left alone,
  and exactly which checks were run.
