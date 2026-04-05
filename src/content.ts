import shopEn from './data/shop.en.json'
import shopEt from './data/shop.et.json'
import tasksEn from './data/tasks.en.json'
import tasksEt from './data/tasks.et.json'
import topicsEn from './data/topics.en.json'
import topicsEt from './data/topics.et.json'
import uiEn from './data/ui.en.json'
import uiEt from './data/ui.et.json'
import type {
  GameTask,
  Locale,
  SupportUpgradeCopy,
  TopicDefinition,
  UiText,
} from './types'

export const DEFAULT_LOCALE: Locale = 'et'
export const LANGUAGE_STORAGE_KEY = 'incremental-programming-game.locale'

const localeContent: Record<
  Locale,
  {
    ui: UiText
    tasks: GameTask[]
    shopNodes: SupportUpgradeCopy[]
    topics: TopicDefinition[]
  }
> = {
  en: {
    ui: uiEn as UiText,
    tasks: tasksEn as GameTask[],
    shopNodes: shopEn as SupportUpgradeCopy[],
    topics: topicsEn as TopicDefinition[],
  },
  et: {
    ui: uiEt as UiText,
    tasks: tasksEt as GameTask[],
    shopNodes: shopEt as SupportUpgradeCopy[],
    topics: topicsEt as TopicDefinition[],
  },
}

export function isLocale(value: string | null): value is Locale {
  return value === 'et' || value === 'en'
}

export function getLocaleContent(locale: Locale) {
  return localeContent[locale]
}

export function getInitialLocale(): Locale {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE
  }

  const storedLocale = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  return isLocale(storedLocale) ? storedLocale : DEFAULT_LOCALE
}

export function formatText(
  template: string,
  replacements: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    return replacements[key] ?? `{${key}}`
  })
}
