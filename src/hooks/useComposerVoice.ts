import { computed, onUnmounted, ref, type ComputedRef } from 'vue'
import type { Editor } from '@tiptap/core'
import type {
  LcComposerErrorDetail,
  LcComposerTranscriptionResult,
  LcComposerVoiceRecordedDetail,
  LcComposerVoiceState,
} from '@/type'
import type { LcResolvedComposerConfig } from './useComposer'

type AudioContextConstructor = typeof AudioContext

export function useComposerVoice(options: {
  editor: Editor
  config: ComputedRef<LcResolvedComposerConfig>
  messages: {
    unsupported: () => string
    permissionDenied: () => string
    providerMissing: () => string
    transcriptionFailed: () => string
  }
  onStateChange: (state: LcComposerVoiceState) => void
  onRecorded: (detail: LcComposerVoiceRecordedDetail) => void
  onComplete: (detail: LcComposerTranscriptionResult) => void
  onError: (detail: LcComposerErrorDetail) => void
}) {
  const state = ref<LcComposerVoiceState>('idle')
  const level = ref(0)
  const duration = ref(0)
  const errorMessage = ref('')
  const busy = computed(() =>
    ['requesting-permission', 'recording', 'stopping', 'transcribing'].includes(state.value)
  )

  let stream: MediaStream | null = null
  let recorder: MediaRecorder | null = null
  let audioContext: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let animationFrame = 0
  let durationTimer: ReturnType<typeof setInterval> | null = null
  let maxDurationTimer: ReturnType<typeof setTimeout> | null = null
  let startedAt = 0
  let chunks: Blob[] = []
  let permissionRequest = 0
  let operation = 0
  let transcriptionController: AbortController | null = null
  let destroyed = false

  function setState(value: LcComposerVoiceState) {
    state.value = value
    options.onStateChange(value)
  }

  function stopTimers() {
    if (durationTimer) clearInterval(durationTimer)
    if (maxDurationTimer) clearTimeout(maxDurationTimer)
    durationTimer = null
    maxDurationTimer = null
    if (animationFrame) cancelAnimationFrame(animationFrame)
    animationFrame = 0
  }

  function stopMedia() {
    stopTimers()
    for (const track of stream?.getTracks() ?? []) track.stop()
    stream = null
    analyser?.disconnect()
    analyser = null
    if (audioContext) void audioContext.close()
    audioContext = null
    level.value = 0
  }

  function fail(message: string, source: LcComposerErrorDetail['source'], cause?: unknown) {
    errorMessage.value = message
    setState('error')
    const error = cause instanceof Error ? cause : new Error(message)
    if (error.message !== message) Object.defineProperty(error, 'message', { value: message })
    options.onError({ error, source })
  }

  function updateLevel() {
    if (!analyser || state.value !== 'recording') return
    const samples = new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(samples)
    const squareMean = samples.reduce((sum, sample) => {
      const normalized = (sample - 128) / 128
      return sum + normalized * normalized
    }, 0) / samples.length
    level.value = Math.min(1, Math.sqrt(squareMean) * 4)
    animationFrame = requestAnimationFrame(updateLevel)
  }

  function beginMeter(mediaStream: MediaStream) {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext
    if (!AudioContextClass) return
    audioContext = new AudioContextClass()
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    audioContext.createMediaStreamSource(mediaStream).connect(analyser)
    updateLevel()
  }

  async function start() {
    if (busy.value) return
    errorMessage.value = ''
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      fail(options.messages.unsupported(), 'voice')
      return
    }

    const request = ++permissionRequest
    operation += 1
    setState('requesting-permission')
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (destroyed || request !== permissionRequest) {
        mediaStream.getTracks().forEach(track => track.stop())
        return
      }
      stream = mediaStream
      chunks = []
      recorder = new MediaRecorder(mediaStream)
      recorder.addEventListener('dataavailable', event => {
        if (event.data.size) chunks.push(event.data)
      })
      recorder.start()
      startedAt = performance.now()
      duration.value = 0
      durationTimer = setInterval(() => {
        duration.value = (performance.now() - startedAt) / 1000
      }, 100)
      if (options.config.value.voice.maxDuration) {
        maxDurationTimer = setTimeout(() => void confirm(), options.config.value.voice.maxDuration * 1000)
      }
      setState('recording')
      beginMeter(mediaStream)
    } catch (error) {
      stopMedia()
      fail(options.messages.permissionDenied(), 'voice', error)
    }
  }

  function stopRecorder() {
    return new Promise<Blob>(resolve => {
      const activeRecorder = recorder
      if (!activeRecorder || activeRecorder.state === 'inactive') {
        resolve(new Blob(chunks, { type: activeRecorder?.mimeType || 'audio/webm' }))
        return
      }
      activeRecorder.addEventListener(
        'stop',
        () => resolve(new Blob(chunks, { type: activeRecorder.mimeType || 'audio/webm' })),
        { once: true }
      )
      activeRecorder.stop()
    })
  }

  async function cancel() {
    permissionRequest += 1
    operation += 1
    transcriptionController?.abort()
    transcriptionController = null
    if (recorder?.state === 'recording') {
      setState('stopping')
      await stopRecorder()
    }
    stopMedia()
    recorder = null
    chunks = []
    errorMessage.value = ''
    setState('idle')
  }

  async function confirm() {
    if (state.value !== 'recording') return
    const currentOperation = operation
    setState('stopping')
    const recordedDuration = Math.max(duration.value, (performance.now() - startedAt) / 1000)
    const audio = await stopRecorder()
    if (destroyed || currentOperation !== operation) return
    const mimeType = recorder?.mimeType || audio.type || 'audio/webm'
    stopMedia()
    recorder = null
    chunks = []
    options.onRecorded({ audio, mimeType, duration: recordedDuration })

    const provider = options.config.value.voice.transcribe
    if (!provider) {
      fail(options.messages.providerMissing(), 'transcription')
      return
    }

    const controller = new AbortController()
    transcriptionController = controller
    setState('transcribing')
    try {
      const result = await provider(audio, {
        signal: controller.signal,
        language: options.config.value.voice.language,
      })
      if (controller.signal.aborted || destroyed || currentOperation !== operation) return
      options.editor.chain().focus().insertContent(result.text).run()
      setState('ready')
      options.onComplete({
        ...result,
        metadata: result.metadata ? { ...result.metadata } : undefined,
      })
    } catch (error) {
      if (controller.signal.aborted || currentOperation !== operation) return
      fail(options.messages.transcriptionFailed(), 'transcription', error)
    } finally {
      if (transcriptionController === controller) transcriptionController = null
    }
  }

  onUnmounted(() => {
    destroyed = true
    permissionRequest += 1
    transcriptionController?.abort()
    transcriptionController = null
    if (recorder?.state === 'recording') recorder.stop()
    recorder = null
    chunks = []
    stopMedia()
  })

  return { state, level, duration, errorMessage, busy, start, cancel, confirm }
}
