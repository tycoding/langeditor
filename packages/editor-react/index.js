import * as React from 'react'

import '@langeditor/core/element'

const EVENT_NAMES = [
  'lc-ready',
  'lc-session-ready',
  'lc-change',
  'lc-input',
  'lc-enter',
  'lc-submit',
  'lc-stop',
  'lc-composer-action',
  'lc-composer-context-change',
  'lc-mention-select',
  'lc-voice-state-change',
  'lc-voice-recorded',
  'lc-transcription-complete',
  'lc-error',
  'lc-document-sync',
  'lc-dark-change',
  'lc-word-comments-change',
  'lc-word-header-footer-change',
  'lc-ai',
  'lc-ai-run-start',
  'lc-ai-text-delta',
  'lc-ai-reasoning-delta',
  'lc-ai-phase',
  'lc-ai-tool-start',
  'lc-ai-tool-executed',
  'lc-ai-turn-end',
  'lc-ai-complete',
  'lc-ai-error',
  'lc-ai-abort',
  'lc-ai-accept',
  'lc-ai-reject',
  'lc-ai-insert',
  'lc-ai-regenerate',
]

function assignProperties(element, props) {
  if (!element) return

  const propertyNames = [
    'value',
    'modelValue',
    'extensions',
    'output',
    'mode',
    'documentSource',
    'layout',
    'composer',
    'composerContext',
    'mention',
    'miniExtensions',
    'toc',
    'wordPageCount',
    'wordHeaderFooter',
    'wordComments',
    'dark',
    'theme',
    'radius',
    'disabled',
    'hideToolbar',
    'hideMenubar',
    'hideBubble',
    'removeDefaultWrapper',
    'editorClass',
    'contentClass',
    'maxWidth',
    'minHeight',
    'maxHeight',
    'license',
    'autoPlugins',
    'pluginOptions',
  ]

  propertyNames.forEach(name => {
    if (props[name] !== undefined) element[name] = props[name]
  })
}

export const LangEditor = React.forwardRef(function LangEditor(props, forwardedRef) {
  const elementRef = React.useRef(null)

  React.useImperativeHandle(forwardedRef, () => elementRef.current, [])

  React.useEffect(() => {
    const element = elementRef.current
    if (!element) return undefined

    const handlers = {
      'lc-ready': event => props.onReady?.(event.detail),
      'lc-session-ready': event => props.onSessionReady?.(event.detail),
      'lc-change': event => props.onChange?.(event.detail),
      'lc-input': event => props.onInput?.(event.detail),
      'lc-enter': event => props.onEnter?.(event.detail),
      'lc-submit': event => props.onSubmit?.(event.detail),
      'lc-stop': event => props.onStop?.(event.detail),
      'lc-composer-action': event => props.onComposerAction?.(event.detail),
      'lc-composer-context-change': event => props.onComposerContextChange?.(event.detail),
      'lc-mention-select': event => props.onMentionSelect?.(event.detail),
      'lc-voice-state-change': event => props.onVoiceStateChange?.(event.detail),
      'lc-voice-recorded': event => props.onVoiceRecorded?.(event.detail),
      'lc-transcription-complete': event => props.onTranscriptionComplete?.(event.detail),
      'lc-error': event => props.onError?.(event.detail),
      'lc-document-sync': event => props.onDocumentSync?.(event.detail),
      'lc-dark-change': event => props.onDarkChange?.(event.detail),
      'lc-word-comments-change': event => props.onWordCommentsChange?.(event.detail),
      'lc-word-header-footer-change': event => props.onWordHeaderFooterChange?.(event.detail),
      'lc-ai': event => props.onAI?.(event.detail),
      'lc-ai-run-start': event => props.onAIRunStart?.(event.detail),
      'lc-ai-text-delta': event => props.onAITextDelta?.(event.detail),
      'lc-ai-reasoning-delta': event => props.onAIReasoningDelta?.(event.detail),
      'lc-ai-phase': event => props.onAIPhase?.(event.detail),
      'lc-ai-tool-start': event => props.onAIToolStart?.(event.detail),
      'lc-ai-tool-executed': event => props.onAIToolExecuted?.(event.detail),
      'lc-ai-turn-end': event => props.onAITurnEnd?.(event.detail),
      'lc-ai-complete': event => props.onAIComplete?.(event.detail),
      'lc-ai-error': event => props.onAIError?.(event.detail),
      'lc-ai-abort': event => props.onAIAbort?.(event.detail),
      'lc-ai-accept': event => props.onAIAccept?.(event.detail),
      'lc-ai-reject': event => props.onAIReject?.(event.detail),
      'lc-ai-insert': event => props.onAIInsert?.(event.detail),
      'lc-ai-regenerate': event => props.onAIRegenerate?.(event.detail),
    }

    EVENT_NAMES.forEach(name => element.addEventListener(name, handlers[name]))
    assignProperties(element, props)

    return () => EVENT_NAMES.forEach(name => element.removeEventListener(name, handlers[name]))
  }, [props])

  return React.createElement('lang-editor', { ref: elementRef })
})
