import type { LcDocumentValue } from '@langeditor/core'
import type { ForwardRefExoticComponent, ReactNode, RefAttributes } from 'react'
import type {
  LangEditorElement,
  LangEditorElementProps,
  LcChangeDetail,
  LcDocumentSyncDetail,
  LcErrorDetail,
  LcAIEventDetail,
  LcAIAgentEventDetail,
  LcInputDetail,
  LcReadyDetail,
  LcSessionReadyDetail,
  LcSubmitDetail,
  LcComposerActionEventDetail,
  LcComposerContextChangeDetail,
  LcMentionSelectDetail,
  LcVoiceStateChangeDetail,
  LcVoiceRecordedDetail,
  LcTranscriptionCompleteDetail,
} from '@langeditor/core/element'

/** Re-exported so React consumers can type-check against the agent workbench events. */
export type { LcAIAgentEventDetail }

export interface LangEditorReactProps extends Omit<LangEditorElementProps, 'value' | 'modelValue'> {
  value?: LcDocumentValue
  modelValue?: LcDocumentValue
  onReady?: (detail: LcReadyDetail) => void
  onSessionReady?: (detail: LcSessionReadyDetail) => void
  onChange?: (detail: LcChangeDetail) => void
  onInput?: (detail: LcInputDetail) => void
  onEnter?: (detail: unknown) => void
  onSubmit?: (detail: LcSubmitDetail) => void
  onStop?: (detail: unknown) => void
  onComposerAction?: (detail: LcComposerActionEventDetail) => void
  onComposerContextChange?: (detail: LcComposerContextChangeDetail) => void
  onMentionSelect?: (detail: LcMentionSelectDetail) => void
  onVoiceStateChange?: (detail: LcVoiceStateChangeDetail) => void
  onVoiceRecorded?: (detail: LcVoiceRecordedDetail) => void
  onTranscriptionComplete?: (detail: LcTranscriptionCompleteDetail) => void
  onError?: (detail: LcErrorDetail) => void
  onDocumentSync?: (detail: LcDocumentSyncDetail) => void
  onDarkChange?: (detail: { value: boolean }) => void
  onWordCommentsChange?: (detail: { value: unknown }) => void
  onWordHeaderFooterChange?: (detail: { value: unknown }) => void
  onAI?: (detail: LcAIEventDetail) => void
  onAIRunStart?: (detail: LcAIEventDetail) => void
  onAITextDelta?: (detail: LcAIEventDetail) => void
  onAIReasoningDelta?: (detail: LcAIEventDetail) => void
  onAIPhase?: (detail: LcAIEventDetail) => void
  onAIToolStart?: (detail: LcAIEventDetail) => void
  onAIToolExecuted?: (detail: LcAIEventDetail) => void
  onAITurnEnd?: (detail: LcAIEventDetail) => void
  onAIComplete?: (detail: LcAIEventDetail) => void
  onAIError?: (detail: LcAIEventDetail) => void
  onAIAbort?: (detail: LcAIEventDetail) => void
  onAIAccept?: (detail: LcAIEventDetail) => void
  onAIReject?: (detail: LcAIEventDetail) => void
  onAIInsert?: (detail: LcAIEventDetail) => void
  onAIRegenerate?: (detail: LcAIEventDetail) => void
  children?: ReactNode
}

export declare const LangEditor: ForwardRefExoticComponent<LangEditorReactProps & RefAttributes<LangEditorElement>>
