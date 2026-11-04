import { computed, inject, provide, type ComputedRef, type InjectionKey, type Ref } from 'vue'

const editorPortalTargetKey: InjectionKey<Ref<HTMLElement | null>> = Symbol('langeditor-portal-target')

export function provideEditorPortalTarget(target: Ref<HTMLElement | null>) {
  provide(editorPortalTargetKey, target)
}

/** Resolve the overlay root for the current editor instance. */
export function useEditorPortalTarget(): ComputedRef<HTMLElement | string> {
  const target = inject(editorPortalTargetKey, null)
  return computed(() => target?.value ?? 'body')
}
