import { ref } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import { useToast } from '@/components/ui/toast/use-toast'
import { AIConversationController } from '@/extensions/AI/conversation'
import type { AIConversationEvent } from '@/extensions/AI/conversation'

export function useAIConversation(editor: Editor) {
  const controller = new AIConversationController()
  const result = ref('')
  const status = ref<'init' | 'generating' | 'completed'>('init')
  const conversationHistory = ref(controller.conversationHistory)
  const { toast } = useToast()

  controller.on(event => {
    result.value = controller.result
    status.value = controller.status
    conversationHistory.value = controller.conversationHistory

    const options = editor.extensionManager.extensions.find(extension => extension.name === 'AI')?.options
    options?.onEvent?.(event)
  })

  async function handleCompletion(
    context: string,
    prompt: string,
    onChunk?: (text: string) => void,
    operation: AIConversationEvent['operation'] = 'document'
  ) {
    const options = editor.extensionManager.extensions.find(extension => extension.name === 'AI')?.options
    if (!options || typeof options.completions !== 'function') {
      const error = new Error('AI completions method is not configured')
      options?.onEvent?.({ type: 'error', error: { name: error.name, message: error.message } })
      throw error
    }

    try {
      return await controller.run(
        context,
        prompt,
        {
          completions: options.completions,
          systemPrompt: options.systemPrompt,
          skills: options.skills,
          modelConfig: options.modelConfig,
          mode: editor.storage.AI?.mode,
          operation,
        },
        onChunk
      )
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        toast({
          title: error?.message || 'Failed to generate AI completion',
          variant: 'destructive',
        })
      }
      throw error
    }
  }

  function resetConversation() {
    controller.reset()
    result.value = controller.result
    status.value = controller.status
    conversationHistory.value = controller.conversationHistory
  }

  function stopGeneration() {
    controller.stop()
    result.value = controller.result
    status.value = controller.status
  }

  return {
    result,
    status,
    conversationHistory,
    handleCompletion,
    resetConversation,
    stopGeneration,
  }
}
