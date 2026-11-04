<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useLocale } from '@/locales'

const props = defineProps<{
  placement: 'sidebar-left' | 'sidebar-right'
  width: number
  minWidth: number
  maxWidth: number
}>()

const emit = defineEmits<{
  resize: [width: number]
}>()
const { t } = useLocale()

const dragging = ref(false)
let startX = 0
let startWidth = 0

function clamp(value: number) {
  return Math.min(props.maxWidth, Math.max(props.minWidth, value))
}

function handlePointerMove(event: PointerEvent) {
  if (!dragging.value) return
  const delta = props.placement === 'sidebar-right' ? startX - event.clientX : event.clientX - startX
  emit('resize', clamp(startWidth + delta))
}

function stopDragging() {
  if (!dragging.value) return
  dragging.value = false
  document.body.style.removeProperty('cursor')
  document.body.style.removeProperty('user-select')
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', stopDragging)
}

function startDragging(event: PointerEvent) {
  if (event.button !== 0) return
  dragging.value = true
  startX = event.clientX
  startWidth = props.width
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', stopDragging)
}

onBeforeUnmount(stopDragging)
</script>

<template>
  <button
    type="button"
    :data-plugin-resize-handle="placement === 'sidebar-right' ? 'right' : 'left'"
    :aria-label="t(placement === 'sidebar-right' ? 'editor.plugin.resizeRight' : 'editor.plugin.resizeLeft')"
    :class="[
      'group relative z-20 w-1 shrink-0 cursor-col-resize border-0 bg-transparent p-0 outline-none transition-colors hover:bg-primary/25 focus-visible:bg-primary/35',
      dragging ? 'bg-primary/40' : '',
    ]"
    @pointerdown="startDragging"
  >
    <span class="pointer-events-none absolute inset-y-0 -left-1 -right-1"></span>
    <span
      class="pointer-events-none absolute inset-y-1/2 left-1/2 h-8 w-px -translate-x-1/2 -translate-y-1/2 rounded-full bg-border/0 transition-colors group-hover:bg-border/80 group-focus-visible:bg-border/80"
    ></span>
  </button>
</template>
