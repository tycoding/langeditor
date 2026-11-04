import { computed, ref, watch } from 'vue'
import { useDark, useLocalStorage } from '@vueuse/core'
import type { BorderRadius, Theme } from '@/constants/index'
import { BORDER_RADIUS, DEFAULT_BORDER_RADIUS, DEFAULT_THEME, THEMES } from '@/constants/index'

export function useTheme() {
  // Use local storage for persistence
  const storedTheme = useLocalStorage<Theme>('lc-editor-theme-color', DEFAULT_THEME)
  const storedBorderRadius = useLocalStorage<BorderRadius>('lc-editor-border-radius', DEFAULT_BORDER_RADIUS)

  // Reactive state
  const theme = ref<Theme>(storedTheme.value)
  const borderRadius = ref<BorderRadius>(storedBorderRadius.value)

  // Configure useDark with selector: null to avoid touching the global html element
  // This solves the conflict with parent application's dark mode
  const isDark = useDark({
    selector: null,
    storageKey: 'lc-editor-dark-mode',
  })

  // Get current theme config
  const currentTheme = computed(() => {
    return THEMES.find(color => color.name === theme.value) || THEMES[0]
  })

  // Get current border radius
  const currentBorderRadius = computed(() => {
    return BORDER_RADIUS.find(radius => radius === borderRadius.value) || DEFAULT_BORDER_RADIUS
  })

  // Helper to update the style tag
  const updateStyleTag = () => {
    const colorConfig = currentTheme.value
    const isDarkMode = isDark.value
    const radiusConfig = currentBorderRadius.value

    const colorScheme = isDarkMode ? colorConfig.cssVars.dark : colorConfig.cssVars.light
    const selectionScheme = isDarkMode
      ? {
          selection: '217 91% 60%',
          'selection-foreground': '210 40% 98%',
        }
      : {
          selection: '214 90% 56%',
          'selection-foreground': '222.2 47.4% 11.2%',
        }

    let themeStyleElement = document.getElementById('lc-editor-theme-styles')
    if (!themeStyleElement) {
      themeStyleElement = document.createElement('style')
      themeStyleElement.id = 'lc-editor-theme-styles'
      document.head.appendChild(themeStyleElement)
    }

    // Generate CSS rules scoped to each editor instance.
    // Include both colors and border radius
    const cssVars = Object.entries({ ...colorScheme, ...selectionScheme })
      .map(([key, value]) => `--${key}: ${value}; --color-${key}: hsl(${value});`)
      .join(' ')

    const radiusVar = `--radius: ${radiusConfig}rem;`

    // Descendants inherit these variables. Avoid defining them on every child,
    // otherwise an instance-level inline theme cannot override the palette.
    const cssRules = `[data-langeditor] { ${cssVars} ${radiusVar} }`

    themeStyleElement.textContent = cssRules
  }

  // Watchers to sync state and update styles
  watch(storedTheme, newColor => {
    theme.value = newColor
  })

  watch(storedBorderRadius, newRadius => {
    borderRadius.value = newRadius
  })

  watch(theme, newColor => {
    storedTheme.value = newColor
    updateStyleTag()
  })

  watch(borderRadius, newRadius => {
    storedBorderRadius.value = newRadius
    updateStyleTag()
  })

  watch(isDark, () => {
    updateStyleTag()
  })

  // Initialize
  updateStyleTag()

  return {
    theme,
    borderRadius,
    isDark,
    themes: THEMES,
    borderRadiusOptions: BORDER_RADIUS,
    currentTheme,
    currentBorderRadius,
    toggleTheme: () => {
      isDark.value = !isDark.value
    },
    setTheme: (color: Theme) => {
      theme.value = color
    },
    setBorderRadius: (radius: BorderRadius) => {
      borderRadius.value = radius
    },
  }
}
