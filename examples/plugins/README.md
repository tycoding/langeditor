# LangEditor Plugin Protocol

This example describes the public plugin boundary used by optional and commercial
packages. A plugin package registers itself as a side effect when it is imported;
the editor discovers the registered definition before creating its Tiptap instance.

## Package layout

Use one package per capability. The recommended private or public package layout is:

```text
packages/editor-plugin-example-callout/
  package.json
  README.md
  src/
    index.ts
    plugin.ts
    manifest.ts
    extensions/
    components/
    ai/
    serializers/
    styles/index.css
  examples/
    vue.ts
    react.tsx
    vanilla.ts
```

Commercial packages follow the same layout in the private canonical repository and
are published independently as `@langeditor/plugin-*`. Do not copy commercial
source into the public repository or rely on an ignored folder as its only backup.

```ts
import { registerEditorPlugin } from '@langeditor/core'
import CalloutPanel from './components/CalloutPanel.vue'

registerEditorPlugin({
  id: 'example-callout',
  version: '1.0.0',
  coreRange: '^1.0.0',
  provides: ['example.callout'],
  create: ({ options }) => ({
    // Extensions are created per editor instance. Never share mutable extension
    // instances between editors.
    extensions: [createCalloutExtension(options)],
    // An extension button is rendered automatically by the existing Toolbar.
    // Slash commands and menubar groups can be contributed through the matching
    // functions on the plugin instance.
    slashCommands: (_editor, _lang) => [],
    menubar: _editor => [],
    ui: _editor => [
      {
        id: 'callout-panel',
        placement: 'sidebar-right',
        component: CalloutPanel,
        props: { tone: 'neutral' },
      },
    ],
  }),
})
```

## UI placements

`ui(editor)` contributions use one of the host slots below:

| Placement | Rendered area | Typical use |
| --- | --- | --- |
| `menubar` | Top menu row | A compound menu or workflow launcher |
| `toolbar` | Top formatting toolbar | A multi-control tool or panel trigger |
| `bubble` | Selection bubble area | Rewrite, translate, explain, or inline AI actions |
| `sidebar-left` | Left editor rail | Outline, navigation, or document context |
| `sidebar-right` | Right editor rail | Forms, review, AI output, or data context |
| `statusbar-left` | Bottom-left status area | Sync, word count, or permission state |
| `statusbar-right` | Bottom-right status area | Mode and action controls |
| `floating` | Editor overlay layer | Assistant, picker, toast, or anchored workflow |

The host always passes `editor`, `pluginId`, and the contribution's resolved `props`
to the Vue component. Use `visible(context)` for state-aware visibility. A bubble
component owns its BubbleMenu/positioning logic so selection changes remain reactive.

## Package rules

- Use a unique `id` and unique Tiptap extension/node names.
- Declare `requires`, `conflicts`, and `licenseFeature` in the manifest.
- Keep `@langeditor/core` and Tiptap packages in `peerDependencies`.
- Mark the registration entry as a side effect so bundlers do not tree-shake it.
- Create extensions inside `create`; mutable extension instances must not be shared. Vue
  component definitions may be imported once, because the host creates a separate component
  instance for each editor.
- Do not redefine an existing node name to replace a core node. Use a contribution
  or enhancement slot, or a namespaced node such as `lcBusinessForm`.
- Prefer extension `options.button` for a single toolbar button. Use `ui()` for compound
  controls and all sidebars, status bars, bubbles, and floating layers.

## License activation

The core runtime accepts verified claims or delegates opaque token verification to
a provider registered by the licensed package:

```ts
import { activateLicense, registerLicenseProvider } from '@langeditor/core'

registerLicenseProvider({
  id: 'example-license',
  verify: token => verifySignedToken(token),
})

activateLicense(import.meta.env.VITE_LANGCHAT_LICENSE)
```

The editor must be mounted after activation when a plugin is license-gated. The
browser package should only enforce feature availability; model credentials,
document permissions, and other sensitive controls do not belong in the client.

## External document surface

Spreadsheet, PDF, and presentation editors register a document surface instead of
injecting a Tiptap node. Keep the registration entry synchronous and the engine
behind `load()` so applications that do not select the mode never download it.

```ts
import { registerEditorPlugin } from '@langeditor/core'

registerEditorPlugin({
  id: '@langeditor/plugin-spreadsheet',
  version: '0.1.0',
  coreRange: '^1.0.0',
  provides: ['document:spreadsheet'],
  surfaces: [
    {
      mode: 'spreadsheet',
      capabilities: ['selection:range', 'operations', 'ai-context', 'page-layout'],
      minHeight: 560,
      load: () => import('./components/SpreadsheetSurface.vue'),
    },
  ],
  create: () => ({}),
})
```

The loaded Vue surface receives `mode`, `modelValue`, `source`, `disabled`,
`options`, `license`, `theme`, and `dark`. It must emit `ready` with a new
`{ session }` for every mounted editor instance, and should emit
`update:modelValue`, `change`, and `error` as appropriate. The session implements
`getValue`, `setValue`, `getSelection`, `getAIContext`, `applyOperations`, and
`focus`; use the optional page-layout methods when the mode supports print headers
and footers.

Consumers import the package once for side-effect registration and then select the
mode on the same LangEditor component:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { LangEditor } from '@langeditor/core'
import '@langeditor/plugin-spreadsheet'

const workbook = ref<Record<string, unknown>>({})
const source = ref<File>()
</script>

<template>
  <LangEditor
    v-model="workbook"
    :document-source="source"
    mode="spreadsheet"
    @session-ready="({ session }) => session.focus()"
  />
</template>
```

Document-agnostic plugins use `createDocument({ session, capabilities,
hasCapability })`. This is the integration point for an AI sidebar or a
provider-neutral collaboration adapter; it does not expose engine-private cell,
slide, or annotation objects to the host.
