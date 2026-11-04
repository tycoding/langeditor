# LangEditor Theme Styling

`@langeditor/core` exposes a small, stable styling surface for embedded hosts.
Import the core stylesheet first, then scope overrides to the editor class:

```ts
import '@langeditor/core/style.css'
```

```css
.app-editor {
  --lc-editor-surface-background: #ffffff;
  --lc-editor-surface-foreground: #18181b;
  --lc-editor-toolbar-background: #fafafa;
  --lc-editor-content-background: #ffffff;
  --lc-editor-border-color: hsl(240 5.9% 90% / 0.9);
  --lc-editor-border-width: 1px;
  --lc-editor-divider-color: hsl(240 5.9% 90% / 0.72);
  --lc-editor-focus-color: hsl(221 83% 53% / 0.55);
  --lc-editor-radius: 10px;
  --lc-editor-accent-background: hsl(221 83% 96%);
  --lc-editor-accent-foreground: hsl(221 83% 35%);
}
```

## Public Classes

These classes are present on both Vue and Web Component renders:

| Class | Region |
| --- | --- |
| `.lc-editor-root` | Built-in `default`, `mini`, `word`, and composer root |
| `.lc-editor-document-root` | Plugin-provided document surface root |
| `.lc-editor-shell` | Shared editor shell below the root |
| `.lc-editor-toolbar-region` | Built-in toolbar and menubar region |
| `.lc-editor-menubar` | Built-in menubar |
| `.lc-editor-toolbar` | Built-in toolbar |
| `.lc-editor-content-area` | Main content and sidebar row |
| `.lc-editor-content-host` | Scrollable content host |
| `.lc-editor-content` | Tiptap content mount |
| `.lc-editor-sidebar` | Built-in left or right sidebar |
| `.lc-editor-statusbar` | Word or default statusbar |
| `.lc-editor-word-page` | A4 page node in Word mode |

Use these selectors instead of relying on generated utility classes or internal
component names. The existing `data-langeditor`, `data-editor-mode`, and
`data-editor-layout` attributes remain available for mode-specific selectors.

## Theme Tokens

`--lc-editor-*` values are instance-scoped. Core theme values remain the fallback,
so an override can be as small as one token:

| Token | Value |
| --- | --- |
| `--lc-editor-surface-background` | Complete CSS color for the root surface |
| `--lc-editor-surface-foreground` | Complete CSS color for root text |
| `--lc-editor-toolbar-background` | Complete CSS color for toolbar and menu surfaces |
| `--lc-editor-toolbar-foreground` | Complete CSS color for toolbar text |
| `--lc-editor-content-background` | Complete CSS color for the content area |
| `--lc-editor-content-foreground` | Complete CSS color for content text |
| `--lc-editor-border-color` | Complete CSS color for editor/document borders |
| `--lc-editor-border-width` | CSS length for editor/document borders |
| `--lc-editor-divider-color` | Complete CSS color for toolbar, statusbar, and sidebar lines |
| `--lc-editor-radius` | CSS length for the root and Word pages |
| `--lc-editor-page-background` | Complete CSS color for Word pages |
| `--lc-editor-muted-foreground` | Complete CSS color for muted labels and metadata |
| `--lc-editor-accent-background` | Complete CSS color for hover and active surfaces |
| `--lc-editor-accent-foreground` | Complete CSS color for hover and active text |
| `--lc-editor-focus-color` | Complete CSS color for keyboard focus outlines |

The palette tokens used by buttons and extensions, such as `primary`, `border`,
`accent`, and `muted-foreground`, use HSL channels to match Tailwind's theme
convention. Override them with a channel value:

```css
.app-editor {
  --lc-editor-primary: 221 83% 53%;
  --lc-editor-primary-foreground: 0 0% 100%;
  --lc-editor-border: 220 13% 86%;
}
```

Word mode deliberately has no outer root border. The page boundary is controlled
by `.lc-editor-word-page`, `--lc-editor-page-background`, `--lc-editor-radius`,
and the page shadow from the core document style.

## Playground Theme Picker

The built-in `theme` prop is the quickest way to let people preview the supported
accent palettes. It is also safe to share between Mini, default, and read-only
instances:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { Theme } from '@langeditor/core'
import { LangEditor } from '@langeditor/core'

const theme = ref<Theme>('blue')
const options: Array<{ name: Theme; color: string }> = [
  { name: 'zinc', color: '#71717a' },
  { name: 'blue', color: '#3b82f6' },
  { name: 'green', color: '#22c55e' },
  { name: 'orange', color: '#f97316' },
]
</script>

<template>
  <button
    v-for="option in options"
    :key="option.name"
    type="button"
    :aria-pressed="theme === option.name"
    :style="{ backgroundColor: option.color }"
    @click="theme = option.name"
  />

  <LangEditor :theme="theme" mode="default" />
</template>
```

Use `--lc-editor-*` tokens when the host needs a brand color or a custom surface
instead of one of the built-in palettes. The tokens can be scoped to a wrapper or
passed through `editorClass`; no global selector is required.

## Height Contract

For a full-height editor, every flex parent between the application frame and the
editor root must provide `height: 100%` (or an explicit height) and `min-height: 0`.
The core root, shell, content row, and Word content host already participate in
this chain. An `auto`-height parent has no remaining height for CSS to resolve.
