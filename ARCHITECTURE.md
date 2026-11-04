# LangEditor Repository Architecture

This document defines the source ownership and dependency boundaries between the
LangEditor public repository and the nested private product workspace.
Product-facing pages continue to use the **Enterprise** name. The
`commercial/` name is an engineering boundary for non-public source code; it is
not a replacement for Enterprise routes, components, or product copy.

## Repository layout

```text
langeditor/
├── src/                              public editor core and built-in extensions
├── packages/                         public distributable packages and adapters
│   └── editor-react/
├── commercial/                       separately versioned commercial workspace
│   ├── .git/                         private repository metadata
│   ├── apps/                         private deployable applications
│   │   ├── playground/
│   │   └── langeditor-server/        unified collaboration/conversion service
│   ├── packages/                     commercial NPM capability packages
│   │   ├── editor-plugin-ai-workbench/
│   │   └── editor-plugin-collaboration/
│   ├── AGENTS.md                     commercial development contract
│   ├── package.json
│   └── pnpm-workspace.yaml
└── examples/                         minimal public integration examples
```

The public repository ignores the complete `commercial/` tree. `commercial/` is
itself a separate Git repository and owns the Playground, commercial packages,
private services and private integration scripts. It may be absent in a public
checkout; public installation, type checking and library builds must continue to
work without it.

## Public component ownership

Shared Vue components are grouped by responsibility under `src/components/`:

```text
components/
├── editor/       host shell and structural editor regions
├── actions/      reusable toolbar and menu action controls
├── toolbar/      default, compact, and Word toolbar composition
├── menubar/      structured top-level menus and their pickers
├── menus/        selection, bubble, content, and AI menus
├── document/     Word page chrome, comments, and page-region UI
├── navigation/   table of contents and navigation surfaces
├── overlays/     dialogs, preview, print, source, and search surfaces
├── plugins/      plugin slots and host resize controls
├── theme/        theme controls
├── icons/        project icon registry
└── ui/           low-level reusable primitives
```

Do not add root-level Vue files to `src/components/`. Stateful document workflows
belong in focused hooks. `components/editor/LangEditorHost.vue` is the public
mode router; `components/editor/LangEditor.vue` remains the composition root for
the shared Tiptap editor instance.

## Document surface boundary

`LangEditorHost.vue` routes `default`, `mini`, and `word` to the existing Tiptap
editor. Other mode IDs are resolved from the plugin registry and rendered by
`ExternalDocumentSurface.vue`. An external document surface is not a Tiptap node
and must not create a hidden second Tiptap editor.

Separately published packages register a surface through
`registerEditorPlugin({ surfaces: [...] })`. The registration entry stays small;
the document engine is loaded only by the surface definition's asynchronous
`load()` function. Once mounted, the surface emits a framework-neutral
`LcDocumentSession`. AI, collaboration, review, and workflow plugins attach to
that session through `createDocument()` and discover optional behavior through
capability IDs.

The shared session owns document values, selection, AI context, operations,
focus, subscriptions, and optional print/page layout. Header/footer state belongs
to the page-layout capability and remains surface-owned. XLSX, PDF, presentation,
or other format dependencies must stay in their independently distributed plugin
packages and must not enter the core or Mini initial bundle. The document surface protocol is documented in
[`docs/document-surfaces.md`](./docs/document-surfaces.md).

## Project categories

| Location | Ownership | Purpose |
| --- | --- | --- |
| `src/` | Public | Shared editor implementation, public extensions, runtime protocols and UI primitives |
| `packages/` | Public | Independently consumable public packages such as framework adapters and future open-source plugins |
| `commercial/packages/` | Commercial | Independently versioned NPM capability packages loaded through the public plugin protocol |
| `commercial/apps/playground/` | Private | Product website, documentation UI and integration scenarios; Enterprise remains the product name |
| `commercial/apps/` | Private | Deployable web apps, servers, workers or CLIs that must not enter a browser package |

Do not introduce a generic `shared/` directory pre-emptively. Code shared by
multiple commercial projects becomes a specifically named package, such as
`commercial/packages/collaboration-protocol`.

## Dependency direction

```text
commercial/apps
      ↓
commercial/packages
      ↓
public @langeditor/core and public packages
```

- Public source must never import files from `commercial/`.
- Commercial packages depend on `@langeditor/core` and shared Tiptap packages
  through declared package dependencies or peer dependencies, never through
  cross-package source-relative imports.
- Commercial apps may consume commercial packages. Commercial packages must not
  import deployable apps.
- Plugin-to-plugin requirements use the plugin manifest (`requires`,
  `conflicts`, `provides`, `enhances`) and declared package dependencies.
- A commercial plugin is a capability package, not a second editor implementation.

Document providers declare content and history ownership through the public
plugin runtime. They publish provider-neutral synchronization through
`lc-document-sync` with `{ source, synced }`; core and framework adapters must not
identify a provider by its extension name, storage key, or private event namespace.

## Workspace and loading boundary

`commercial/` is a self-contained private pnpm workspace with `apps/*` and
`packages/*` members. Its dependency graph, lockfile, development scripts and Git
history are independent from the public repository.

The private Playground source-loads packages found under `commercial/packages/`
for local integration and consumes the public core through its declared package
dependency and local build aliases. Public core styles must not scan or compile
private source. Each distributable commercial package owns its release styles;
the Playground may scan private local sources only for development previews.

## Git ownership boundary

No file may be tracked by both repositories:

| Repository | Git root | Owns |
| --- | --- | --- |
| Public | `langeditor/.git` | `src/`, public `packages/`, `examples/`, public documentation and root build configuration |
| Private | `langeditor/commercial/.git` | `apps/playground`, commercial apps/packages, private scripts, PRDs and private workspace configuration |

The public `.gitignore` excludes `/commercial/` and the legacy `/playground/`
path. The private `.gitignore` independently excludes dependencies, build output,
local environment files and secrets. Never force-add `commercial/` from the
public repository and do not register the private repository as a public
submodule.

Run Git commands with an explicit working directory when both repositories are
present:

```bash
git -C /path/to/langeditor status
git -C /path/to/langeditor/commercial status
```

## Development references

- Read [`docs/development.md`](./docs/development.md) before changing any editor behavior.
- Read [`docs/ai-composer.md`](./docs/ai-composer.md)
  before implementing or extending the public AI Composer layout, context,
  Mention, voice, or submission protocols.
- Read [`docs/document-mode-plugins.md`](./docs/document-mode-plugins.md)
  before implementing a Spreadsheet, PDF, Presentation, or other external
  document-mode plugin. It contains the package, UI, session, operation,
  serialization, AI/collaboration, and verification checklist.
- Read `commercial/AGENTS.md` before changing anything under `commercial/`.
- Then read the target package's README/PRD, manifest, public types and adjacent
  implementation before editing.
