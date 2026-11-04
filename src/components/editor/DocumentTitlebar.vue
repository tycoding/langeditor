<script setup lang="ts">
withDefaults(defineProps<{
  icon: string
  title: string
  status: string
  meta: string
  hasFloatingUi?: boolean
}>(), {
  hasFloatingUi: false,
})
</script>

<template>
  <div
    class="flex min-h-12 flex-none items-center justify-between gap-4 px-3.5 py-[7px] text-white"
    style="background-color: var(--lc-document-accent, var(--lc-word-accent, #185abd))"
  >
    <div class="flex min-w-0 items-center gap-2.5">
      <span
        class="inline-flex size-7 shrink-0 items-center justify-center rounded-[5px] border border-white/40 bg-black/10 text-[15px] font-bold"
        aria-hidden="true"
      >
        {{ icon }}
      </span>
      <div class="flex min-w-0 flex-col gap-px">
        <strong class="truncate text-[13px] font-semibold leading-[1.2]">{{ title }}</strong>
        <span class="truncate text-[10px] leading-[1.2] text-white/70">{{ status }}</span>
      </div>
    </div>
    <span
      :style="hasFloatingUi ? { marginRight: 'var(--lc-word-floating-offset, 48px)' } : undefined"
      class="shrink-0 whitespace-nowrap text-[10px] leading-[1.2] text-white/70"
    >
      {{ meta }}
    </span>
  </div>
</template>
