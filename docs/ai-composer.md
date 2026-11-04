# AI Composer

AI Composer presents the existing Tiptap editor as a rich prompt input. It shares
the editor's document, extensions, serialization, theme, locales, and framework
adapters. Model requests, uploads, transcription services, and credentials belong
to the host application.

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { BaseKit, History, LangEditor } from '@langeditor/core'
import '@langeditor/core/style.css'

const content = ref('')
const context = ref([])
const extensions = [BaseKit, History]
const composer = { voice: { visible: false } }

function onSubmit(detail) {
  // Pass the snapshot to the host application's request handler.
  console.log(detail.text, detail.contextItems, detail.mentions)
}
</script>

<template>
  <LangEditor
    v-model="content"
    v-model:composer-context="context"
    :extensions="extensions"
    :composer="composer"
    layout="composer"
    @submit="onSubmit"
  />
</template>
```

See the [runnable Composer example](../examples/composer/README.md) for attachments,
async Mention sources, footer actions, and a mock transcription provider.

`layout` controls presentation; `mode` selects editing capabilities. Composer
supports `default` and `mini`; Word mode retains the editor layout. Mini continues
to use its extension allowlist.

## Configuration

Public configuration and event types are exported from `@langeditor/core` and
defined in [`src/type.ts`](../src/type.ts).

| Option | Default | Purpose |
| --- | --- | --- |
| `minHeight` | `96` | Minimum input height in pixels, or a CSS length |
| `maxHeight` | `320` | Maximum input height before scrolling |
| `submitOnEnter` | `true` | Enter submits; Shift+Enter adds a line break |
| `clearOnSubmit` | `false` | Clear editor content after emitting a submission |
| `accept` | `*/*` | Accepted attachment types |
| `maxContextItems` | `12` | Context item limit |
| `maxFileSize` | `26214400` | Per-file limit in bytes (25 MiB) |
| `state` | `idle` | Host-controlled submission/streaming state |
| `send` | Visible, circular, medium, primary | Send control presentation and stop behavior |
| `voice` | Visible, dictation, waveform | Recording and host transcription callback |
| `addMenu` | Visible | Upload, reference, action, and submenu entries |
| `actions` | `[]` | Host-defined footer actions |

Enter does not submit during IME composition. Submission is disabled while a
required context item is uploading/processing, during voice capture/transcription,
and while the host reports `validating` or `submitting`. An empty document without
context items cannot be submitted. During `streaming`, the send control emits a
stop request when `send.stopWhenStreaming` is enabled.

## Context and Mention

`composerContext` is a controlled array of `LcComposerContextItem`. Context may
represent a file, image, knowledge record, document, URL, selection, tool, or
custom resource. Items carry stable IDs, labels, optional previews/metadata,
and `ready`, `uploading`, `processing`, or `error` states.

Paste, drop, and the file picker add files to this context model. Ordinary HTML
and text paste remains handled by Tiptap. Context is returned separately from the
editor document; an attached file does not automatically become a document node.
The host owns uploads and updates item status through the controlled prop.

`mention.sources` accepts arrays or asynchronous query functions with configurable
ID, label, and value fields. Inline Mention nodes preserve their ID, label,
source, trigger, value, and metadata in document serialization. Source metadata
and credentials remain host responsibilities.

## Voice

Voice uses browser media APIs and `composer.voice.transcribe(audio, context)`.
The callback receives an `AbortSignal` and optional language, and returns text
with optional language and metadata. The completed transcript is inserted into
the editor for further editing.

The lifecycle is permission request → recording → stopping → transcribing →
ready. Cancel stops recording and aborts pending transcription. Unmount releases
media tracks, audio resources, timers, and pending work. Unsupported recording,
permission denial, and transcription errors have localized feedback.

Without a transcription callback, the editor emits the recorded audio and reports
a missing-provider error; it does not upload audio to a default service.

## Events and framework adapters

A submission contains `html`, `json`, `text`, `contextItems`, `mentions`, and
optional metadata. Submission emits a snapshot; the host performs the model
request and updates `composer.state`.

| Vue event | Web Component event |
| --- | --- |
| `submit` | `lc-submit` |
| `stop` | `lc-stop` |
| `composer-action` | `lc-composer-action` |
| `update:composerContext` | `lc-composer-context-change` |
| `mention-select` | `lc-mention-select` |
| `voice-state-change` | `lc-voice-state-change` |
| `voice-recorded` | `lc-voice-recorded` |
| `transcription-complete` | `lc-transcription-complete` |
| `error` | `lc-error` |

Web Component consumers pass configuration, arrays, and provider callbacks through
DOM properties. React uses the same element through the thin
[`@langeditor/react` adapter](../packages/editor-react/README.md).

Vue slots can replace `composer-context`, `composer-footer-start`,
`composer-footer-center`, `composer-footer-end`, `composer-add-menu`,
`composer-voice`, and `composer-send`. Configuration and DOM events remain the
portable interface for other frameworks.

## Implementation map

| Location | Responsibility |
| --- | --- |
| `src/components/composer/` | Context tray, input shell, footer, add menu, and voice UI |
| `src/hooks/useComposer.ts` | Defaults, submission state, snapshots, actions, and stop requests |
| `src/hooks/useComposerContext.ts` | Context updates, file validation, and preview lifecycle |
| `src/hooks/useComposerVoice.ts` | Capture, metering, cancellation, and transcription |
| `src/extensions/Mention/` | Inline Mention and suggestion UI |
| `src/element/` | Framework-neutral properties, methods, and CustomEvents |

Keep UI text in both locale dictionaries. Preserve keyboard focus, menu operation,
reduced-motion behavior, and bounded input scrolling. Optional features must not
introduce DOCX, chart, code-editor, or commercial runtimes into Mini's initial
bundle. See [development guidelines](./development.md) for verification and
extension constraints.
