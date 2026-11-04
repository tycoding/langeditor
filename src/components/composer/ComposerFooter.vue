<script setup lang="ts">
import { computed } from 'vue'
import { Icon, icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useLocale } from '@/locales'
import type { LcComposerAction, LcComposerAddMenuItem, LcComposerVoiceState } from '@/type'
import type { LcResolvedComposerConfig } from '@/hooks/useComposer'
import ComposerAddMenu from './ComposerAddMenu.vue'
import ComposerVoiceSurface from './ComposerVoiceSurface.vue'

const props = defineProps<{
  config: LcResolvedComposerConfig
  disabled?: boolean
  submitDisabled: boolean
  streaming: boolean
  voiceState: LcComposerVoiceState
  voiceLevel: number
  voiceDuration: number
  voiceError?: string
}>()
const emit = defineEmits<{
  (event: 'files', files: FileList): void
  (event: 'action', action: LcComposerAction | LcComposerAddMenuItem): void
  (event: 'submit'): void
  (event: 'stop'): void
  (event: 'voice'): void
  (event: 'voice-cancel'): void
  (event: 'voice-confirm'): void
  (event: 'error', error: Error): void
}>()
const { t } = useLocale()

const actions = computed(() => ({
  start: props.config.actions.filter(action => (action.position ?? 'start') === 'start'),
  center: props.config.actions.filter(action => action.position === 'center'),
  end: props.config.actions.filter(action => action.position === 'end'),
}))

function isIconName(value?: string): value is keyof typeof icons {
  return Boolean(value && value in icons)
}

const sendSize = computed(() => {
  const size = props.config.send.size
  if (typeof size === 'number') return { width: `${size}px`, height: `${size}px` }
  const pixels = size === 'sm' ? 30 : size === 'lg' ? 42 : 36
  return { width: `${pixels}px`, height: `${pixels}px` }
})
const sendShape = computed(() =>
  props.config.send.shape === 'circle'
    ? 'rounded-full'
    : props.config.send.shape === 'square'
      ? 'rounded-sm'
      : 'rounded-md'
)
const sendColorClass = computed(() => {
  if (props.config.send.color === 'primary') return 'bg-primary text-primary-foreground hover:bg-primary/90'
  if (props.config.send.color === 'foreground') return 'bg-foreground text-background hover:bg-foreground/90'
  return 'bg-[var(--lc-composer-send-color)] text-white brightness-100 hover:brightness-95'
})
const sendColorStyle = computed(() =>
  props.config.send.color === 'primary' || props.config.send.color === 'foreground'
    ? undefined
    : { '--lc-composer-send-color': props.config.send.color }
)

function handleSendClick() {
  if (props.streaming) emit('stop')
  else emit('submit')
}
</script>

<template>
  <footer
    v-if="voiceState !== 'idle' && voiceState !== 'ready'"
    class="flex h-12 min-w-0 flex-none items-center gap-1.5 px-2.5 pb-1"
    data-composer-footer
  >
    <slot
      name="voice"
      :cancel="() => emit('voice-cancel')"
      :confirm="() => emit('voice-confirm')"
      :duration="voiceDuration"
      :level="voiceLevel"
      :state="voiceState"
    >
      <ComposerVoiceSurface
        :duration="voiceDuration"
        :error="voiceError"
        :level="voiceLevel"
        :state="voiceState"
        :waveform="config.voice.waveform"
        @cancel="emit('voice-cancel')"
        @confirm="emit('voice-confirm')"
      />
    </slot>
    <slot name="send" :disabled="true" :state="config.state">
      <TooltipProvider v-if="config.send.visible">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              size="icon"
              :class="['flex-none p-0', sendShape, sendColorClass]"
              :style="[sendSize, sendColorStyle]"
              :aria-label="t('editor.composer.submit')"
              disabled
            >
              <Icon name="ArrowUp" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ t('editor.composer.submit') }}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </slot>
  </footer>
  <footer v-else class="flex h-12 min-w-0 flex-none items-center gap-2 px-2.5 pb-1" data-composer-footer>
    <div class="flex min-w-0 flex-1 items-center gap-1">
      <slot name="start" :actions="actions.start">
        <slot name="add-menu">
          <ComposerAddMenu
            v-if="config.addMenu.visible"
            :accept="config.accept"
            :config="config.addMenu"
            :disabled="disabled"
            @action="emit('action', $event)"
            @error="emit('error', $event)"
            @files="emit('files', $event)"
          />
        </slot>
        <Button
          v-for="action in actions.start"
          :key="action.id"
          class="h-8 max-w-48 gap-1.5 px-2 text-xs"
          :variant="action.active ? 'secondary' : 'ghost'"
          :aria-pressed="action.type === 'toggle' ? action.active : undefined"
          :disabled="disabled || action.disabled"
          @click="emit('action', action)"
        >
          <Icon v-if="isIconName(action.icon)" :name="action.icon" />
          <span class="truncate">{{ action.label }}</span>
        </Button>
      </slot>
    </div>

    <div v-if="actions.center.length || $slots.center" class="flex min-w-0 items-center justify-center gap-1">
      <slot name="center" :actions="actions.center">
        <Button
          v-for="action in actions.center"
          :key="action.id"
          class="h-8 max-w-48 gap-1.5 px-2 text-xs"
          :variant="action.active ? 'secondary' : 'ghost'"
          :aria-pressed="action.type === 'toggle' ? action.active : undefined"
          :disabled="disabled || action.disabled"
          @click="emit('action', action)"
        >
          <Icon v-if="isIconName(action.icon)" :name="action.icon" />
          <span class="truncate">{{ action.label }}</span>
        </Button>
      </slot>
    </div>

    <div class="flex min-w-0 flex-1 items-center justify-end gap-1">
      <slot name="end" :actions="actions.end">
        <Button
          v-for="action in actions.end"
          :key="action.id"
          class="h-8 max-w-48 gap-1.5 px-2 text-xs"
          :variant="action.active ? 'secondary' : 'ghost'"
          :aria-pressed="action.type === 'toggle' ? action.active : undefined"
          :disabled="disabled || action.disabled"
          @click="emit('action', action)"
        >
          <Icon v-if="isIconName(action.icon)" :name="action.icon" />
          <span class="truncate">{{ action.label }}</span>
        </Button>
        <slot name="voice">
          <TooltipProvider v-if="config.voice.visible">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  class="h-8 w-8 rounded-full p-0"
                  size="icon"
                  variant="ghost"
                  :aria-label="t('editor.composer.voice.start')"
                  :disabled="disabled"
                  @click="emit('voice')"
                >
                  <Icon name="Mic" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{{ t('editor.composer.voice.start') }}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </slot>
        <slot name="send" :disabled="submitDisabled" :state="config.state">
          <TooltipProvider v-if="config.send.visible">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  size="icon"
                  :class="['flex-none p-0', sendShape, sendColorClass]"
                  :style="[sendSize, sendColorStyle]"
                  :aria-label="t(streaming ? 'editor.composer.stop' : 'editor.composer.submit')"
                  :disabled="disabled || (submitDisabled && !streaming)"
                  @click="handleSendClick"
                >
                  <Icon :name="streaming ? 'Stop' : 'ArrowUp'" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{{ t(streaming ? 'editor.composer.stop' : 'editor.composer.submit') }}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </slot>
      </slot>
    </div>
  </footer>
</template>
