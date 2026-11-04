<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Icon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/locales'
import type { LcComposerVoiceState } from '@/type'

const props = defineProps<{
  state: LcComposerVoiceState
  level: number
  duration: number
  error?: string
  waveform?: boolean
}>()
const emit = defineEmits<{ (event: 'cancel'): void; (event: 'confirm'): void }>()
const { t } = useLocale()

const SAMPLE_COUNT = 128
const samples = ref<number[]>(Array.from({ length: SAMPLE_COUNT }, () => 1))
let sampleTimer: ReturnType<typeof setInterval> | null = null

function stopSampling() {
  if (sampleTimer) clearInterval(sampleTimer)
  sampleTimer = null
}

function sampleLevel() {
  const normalized = props.level <= 0.04 ? 0 : Math.min(1, (props.level - 0.04) / 0.96)
  const height = normalized === 0 ? 1 : Math.max(3, Math.round(3 + normalized * 21))
  samples.value = [...samples.value.slice(1), height]
}

watch(
  () => props.state,
  state => {
    stopSampling()
    if (state !== 'recording') return
    samples.value = Array.from({ length: SAMPLE_COUNT }, () => 1)
    sampleTimer = setInterval(sampleLevel, 48)
  },
  { immediate: true },
)

onBeforeUnmount(stopSampling)

const label = computed(() =>
  props.state === 'error'
    ? props.error || t.value('editor.composer.voice.error')
    : props.state === 'stopping' || props.state === 'transcribing'
      ? t.value('editor.composer.voice.transcribingLabel')
      : t.value(`editor.composer.voice.${props.state === 'requesting-permission' ? 'requesting' : props.state}`)
)
const discardLabel = computed(() =>
  props.state === 'requesting-permission'
    ? t.value('editor.composer.voice.cancel')
    : t.value('editor.composer.voice.discard')
)
</script>

<template>
  <div
    class="flex min-w-0 flex-1 items-center gap-2"
    role="status"
    :aria-label="label"
    data-composer-voice
  >
    <Button
      class="h-8 w-8 flex-none rounded-full bg-muted p-0 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
      size="icon"
      variant="ghost"
      :aria-label="discardLabel"
      :title="discardLabel"
      @click="emit('cancel')"
    >
      <Icon name="Close" class="h-3.5 w-3.5" />
    </Button>
    <div class="relative flex min-w-0 flex-1 items-center justify-center">
      <div
        v-if="state === 'recording' && waveform"
        class="relative grid h-7 w-full items-center gap-px overflow-hidden"
        :style="{ gridTemplateColumns: `repeat(${samples.length}, minmax(1px, 1fr))` }"
        aria-hidden="true"
      >
        <span class="absolute inset-x-0 top-1/2 border-t border-dotted border-muted-foreground/35" />
        <span
          v-for="(height, index) in samples"
          :key="index"
          class="relative z-10 mx-auto w-px rounded-full"
          :class="height > 1 ? 'bg-foreground' : 'bg-muted-foreground/45'"
          :style="{ height: `${height}px` }"
        />
      </div>
      <span v-else class="truncate px-2 text-xs text-muted-foreground">{{ label }}</span>
    </div>
    <Button
      v-if="state === 'recording'"
      class="h-8 w-8 flex-none rounded-full bg-muted p-0 text-foreground hover:bg-muted/80"
      size="icon"
      variant="ghost"
      :aria-label="t('editor.composer.voice.confirm')"
      :title="t('editor.composer.voice.confirm')"
      @click="emit('confirm')"
    >
      <Icon name="Stop" class="h-3 w-3 fill-current" />
    </Button>
    <Button
      v-else-if="state === 'requesting-permission' || state === 'stopping' || state === 'transcribing'"
      class="h-8 w-8 flex-none rounded-full bg-muted p-0 text-muted-foreground"
      size="icon"
      variant="ghost"
      :aria-label="label"
      :title="label"
      disabled
    >
      <Icon name="LoaderCircle" class="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
    </Button>
  </div>
</template>
