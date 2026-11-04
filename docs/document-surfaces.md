# LangEditor Document Surface Architecture

For the implementation sequence, UI rules, serializer fidelity checks, and
release checklist, also read
[`document-mode-plugins.md`](./document-mode-plugins.md).

## Goal

Applications select an editing shape through one public component:

```vue
<LangEditor mode="spreadsheet" :document-source="file" />
```

The host must not bundle or instantiate every document engine. Rich text remains
Tiptap-based, while spreadsheet, PDF, presentation, and future modes are separate
npm capability packages registered by side effect.

## Runtime flow

```text
mode
  |-- default / mini / word -> existing LangEditor.vue -> Tiptap Editor
  `-- registered external mode
       -> plugin surface load() dynamic import
       -> surface creates one LcDocumentSession per mounted editor
       -> AI/collaboration/review plugins createDocument(session)
       -> shared menubar/toolbar/sidebar/bubble/statusbar/floating slots
```

An external surface owns its engine and document model. It is not a Tiptap node,
must not mount a hidden Tiptap editor, and must not expose engine-private mutable
objects as the cross-plugin contract.

## Shared contracts

`LcDocumentSource` accepts a URL, string, File, Blob, ArrayBuffer, Uint8Array, or a
descriptor containing source metadata. Binary input is intentionally separate
from `v-model`.

`LcDocumentValue` is the serializable live snapshot used by Vue, Web Components,
and React. The surface decides its schema and documents it in its package README.

`LcDocumentSession` provides:

- value reads/writes;
- a mode-specific selection snapshot;
- compact AI context;
- typed operations with an origin (`user`, `ai`, `remote`, `import`, or `host`);
- focus, teardown, and optional subscriptions;
- optional page-layout reads/writes for print layout, header, and footer state.

Capability IDs allow generic plugins to degrade explicitly. A spreadsheet package
can advertise `selection:range`, `operations`, `ai-context`, and `page-layout`.
An AI plugin can still provide document-level chat without range selection, while
a collaboration plugin can refuse initialization when operations are unavailable.

## Spreadsheet package boundary

The spreadsheet capability should be published as a public package such as
`@langeditor/plugin-spreadsheet` with a permissive open-source dependency stack.
The intended boundary is:

| Concern | Package-owned responsibility |
| --- | --- |
| Grid and formula engine | IronCalc adapter loaded asynchronously |
| XLSX import/export | Replaceable serializer adapter, audited before package release |
| CSV import/export | Papa Parse adapter or equivalent permissive parser |
| Collaboration | Session operations mapped to Yjs/provider protocol |
| AI | Range/document context and validated cell operations |
| Print layout | Paper, margins, repeating regions, header, footer, and page tokens |

Neither Univer nor a dual/commercial grid license belongs in this package. The
engine and serializer choices remain behind local adapters so a license,
maintenance, browser-size, or fidelity issue does not require changing LangEditor
core or its framework adapters.

XLSX fidelity must be diagnostic rather than silent. The package README/PRD must
state the supported subset for formulas, styles, merged cells, images, charts,
data validation, conditional formatting, frozen panes, print settings, and macros.
Unsupported workbook features must produce import diagnostics and retain source
metadata when round-trip preservation is possible.

## Header and footer behavior

Header/footer data is part of the external surface's `page-layout` capability,
not a Tiptap Word node. Visible page chrome is separately opt-in through the
`page-chrome` capability so workspace surfaces such as Spreadsheet can retain
print metadata without rendering Word-like page regions while editing. PDF and
presentation surfaces may implement both capabilities when their editing model
uses visible page regions.

Word mode keeps its current `WordHeaderFooterConfig`; no migration is required.
The common session shape is the interoperability boundary for future plugins, not
a forced rewrite of the existing Word implementation.

## AI and collaboration

AI and collaboration packages implement `createDocument()` and consume only the
session contract plus declared capabilities. AI edits are expressed as validated
operations, not direct engine mutation. Collaboration providers publish the
provider-neutral `lc-document-sync` event and map remote changes to the same
operation/value lifecycle.

Credentials, license verification secrets, conversion services, and persistence
authorization remain server-side. A browser package may receive short-lived
configuration but must not contain permanent model or service credentials.

## Future modes

- PDF usually exposes annotation, form, redaction, and page-order operations; raw
  PDF content editing should only be claimed when the chosen engine supports it.
- Presentation mode exposes slide/object selection and operations rather than
  pretending slides are rich-text blocks.
- A future engine can register any unique mode ID without modifying Vue, the Web
  Component, or React adapter, provided it implements the same surface lifecycle.
