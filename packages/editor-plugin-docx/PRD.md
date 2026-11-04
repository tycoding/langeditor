# DOCX Plugin PRD

## Boundary

`@langeditor/plugin-docx` owns DOCX import, DOCX export, Word image handling,
and DOCX fallback registration. Core owns the editor, Word page layout, and
comment model but does not load DOCX runtimes.

## Runtime behavior

- Package import registers per-editor `ImportWord` and `ExportWord` extensions.
- DOCX parsing and serialization use dynamic imports from the command handlers.
- The package is usable through Vue, Web Components, and the React adapter because
  the extensions are ordinary Tiptap extensions.
- Import failures, file-size failures, and unsupported structures remain
  localized through the core locale and diagnostics APIs.

## License

MIT. No commercial license feature is required.
