<script lang="ts" setup>
withDefaults(defineProps<{ level?: number }>(), { level: 0 })
</script>

<template>
  <svg aria-hidden="true" class="size-[18px] shrink-0 text-muted-foreground" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <g v-if="level === 0" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.45">
      <path d="M6.4 4.2h4.1a3.1 3.1 0 0 1 0 6.2H9.2" />
      <path d="M9.2 4.2v11.6M12.1 4.2v11.6" />
    </g>
    <g v-else fill="currentColor">
      <path d="M2.5 4h1.8v4.7h5V4h1.8v12H9.3v-5.6h-5V16H2.5z" />
      <text x="12.5" y="15.4" font-family="ui-sans-serif, system-ui, sans-serif" font-size="7.5" font-weight="700">
        {{ level }}
      </text>
    </g>
  </svg>
</template>
