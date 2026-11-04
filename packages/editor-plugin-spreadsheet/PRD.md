# Spreadsheet Document Mode PRD

## Purpose

Provide a permissively licensed spreadsheet editor as the independently
installable `@langeditor/plugin-spreadsheet` package. Importing the package
registers `mode="spreadsheet"`; the grid and format runtimes are downloaded only
when that mode is mounted.

## License and dependencies

The package itself is MIT. Runtime dependencies are restricted to permissive
licenses:

- official `@ironcalc/wasm` under MIT/Apache-2.0 for workbook calculation;
- `@e965/xlsx` under Apache-2.0 for XLSX/ODS import;
- ExcelJS under MIT for style-preserving XLSX export;
- Papa Parse under MIT for CSV serialization.

Univer, Handsontable, and any dependency requiring a commercial web-use license
are explicitly out of scope.

## Current scope

- editable cell grid with keyboard navigation and range selection;
- formulas calculated by IronCalc;
- basic cell formatting: font family and size, emphasis, text/fill color,
  horizontal alignment, and wrapping;
- merge and unmerge selected cell ranges;
- multiple worksheet tabs with double-click rename;
- XLSX and CSV import/export;
- serializable workbook snapshot for `v-model`;
- spreadsheet selection, AI context, and operation support through
  `LcDocumentSession`;
- shared LangEditor toolbar/statusbar slots;
- shared blue document title bar without Word page chrome;
- Chinese and English UI.

## Non-goals

The plugin does not claim complete Excel fidelity. Macros, pivot tables,
embedded charts/images, external workbook links, protected/encrypted workbooks,
and advanced print areas are not editable. Import returns diagnostics for features
that cannot be represented safely.

## UI placement

- `toolbar`: import/export, font formatting, colors, alignment, wrapping,
  merge/unmerge, clear formatting, add row/column, and add sheet.
- `statusbar-left`: active worksheet and selected range.
- document surface: formula bar, row/column headers, virtual scrolling grid, and
  worksheet tabs.
- document title bar: host-owned blue title bar shared with Word and future
  document modes; spreadsheet print metadata does not render Word page chrome.

No second toolbar row is created. The grid releases all listeners and the WASM
model when its document session is destroyed.

## AI and collaboration

`getAIContext()` returns a bounded snapshot of the selected range including raw
formula input and formatted values. AI or collaboration changes use validated
spreadsheet operations rather than direct DOM or engine mutation. Provider
credentials and document authorization remain outside this browser package.

## Failure states

- WASM initialization failure: surface error with retry available from the host.
- unsupported/corrupt import: localized actionable error plus diagnostics.
- oversized range: AI context is truncated and marked in metadata.
- unsupported operation: rejected with an explicit error; document state is not
  partially mutated.
