# Public AI Composer example

This Vue example uses the public `LangEditor` component with `layout="composer"`.
It demonstrates rich HTML paste, image/file context cards, async mapped `@mention`
items, a host-provided footer action, the built-in send button, and a mock
provider-neutral transcription callback.

```bash
pnpm install
pnpm dev
```

The mock transcription provider never uploads audio and contains no credentials.
