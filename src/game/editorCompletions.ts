import type { ReferenceValueItem } from '../types'

export type EditorCompletionItem = {
  label: string
  apply?: string
  detail?: string
  type?: 'function' | 'keyword' | 'variable' | 'constant' | 'snippet'
}

type BuildEditorCompletionsParams = {
  variant: 'main' | 'helper'
  availableFunctions: string[]
  availableStructures: string[]
  referenceValues: ReferenceValueItem[]
  helperProgramSource: string
}
function extractHelperNames(source: string): string[] {
  const matches = source.matchAll(/^\s*def\s+([A-Za-z_]\w*)\s*\(\s*\)\s*:/gm)
  const names = new Set<string>()

  for (const match of matches) {
    const name = match[1]

    if (name !== undefined) {
      names.add(name)
    }
  }

  return [...names]
}

function dedupeCompletionItems(items: EditorCompletionItem[]) {
  const seen = new Set<string>()

  return items.filter((item) => {
    const key = `${item.label}::${item.apply ?? item.label}`

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

const BUILT_IN_REFERENCE_LABELS = new Set([
  'portal_side',
  'next_ball',
  'bonus_map',
  'center_ball',
  'portal_ball',
  'negative_ball',
])

export function buildEditorCompletions({
  variant,
  availableFunctions,
  availableStructures,
  referenceValues,
  helperProgramSource,
}: BuildEditorCompletionsParams): EditorCompletionItem[] {
  const items: EditorCompletionItem[] = []
  const helperNames = variant === 'main' ? extractHelperNames(helperProgramSource) : []
  const helperCall =
    availableFunctions.find(
      (entry) =>
        entry !== 'drop_ball()' &&
        entry !== 'choose_input(2)' &&
        entry !== 'skip_ball()',
    ) ?? null

  for (const value of referenceValues) {
    if (!BUILT_IN_REFERENCE_LABELS.has(value.label)) {
      continue
    }

    items.push({
      label: value.label,
      type: 'constant',
    })
  }

  for (const fn of availableFunctions) {
    items.push({
      label: fn,
      apply: fn,
      type: 'function',
    })
  }

  for (const helperName of helperNames) {
    items.push({
      label: `${helperName}()`,
      apply: `${helperName}()`,
      type: 'function',
    })
  }

  const hasIf = availableStructures.some((entry) => entry.startsWith('if '))
  const hasElif = availableStructures.some((entry) => entry.startsWith('elif '))
  const hasElse = availableStructures.includes('else:')
  const hasForRange = availableStructures.some((entry) => entry.startsWith('for ball in range'))
  const hasForList = availableStructures.some((entry) => entry.includes('bonus_map'))
  const hasFunctionDefinition = availableStructures.some((entry) => entry.startsWith('def '))

  if (hasIf) {
    items.push({
      label: 'if block',
      apply: 'if next_ball == negative_ball:\n    skip_ball()',
      type: 'snippet',
    })
  }

  if (hasIf && hasElse) {
    items.push({
      label: 'if / else block',
      apply:
        'if next_ball == negative_ball:\n    skip_ball()\nelse:\n    choose_input(portal_side)\n    drop_ball()',
      type: 'snippet',
    })
  }

  if (hasIf && hasElif && hasElse) {
    items.push({
      label: 'if / elif / else block',
      apply: helperCall
        ? `if next_ball == negative_ball:\n    skip_ball()\nelif next_ball == center_ball:\n    choose_input(2)\n    drop_ball()\nelse:\n    ${helperCall}`
        : 'if next_ball == negative_ball:\n    skip_ball()\nelif next_ball == center_ball:\n    choose_input(2)\n    drop_ball()\nelse:\n    choose_input(portal_side)\n    drop_ball()',
      type: 'snippet',
    })
  }

  if (hasForRange) {
    items.push({
      label: 'for range block',
      apply: 'for shot in range(3):\n    drop_ball()',
      type: 'snippet',
    })
  }

  if (hasForList) {
    items.push({
      label: 'for list block',
      apply: 'for multiplier in bonus_map:\n    choose_input(1)',
      type: 'snippet',
    })
  }

  if (variant === 'helper' && hasFunctionDefinition) {
    items.push({
      label: 'def helper():',
      apply: 'def helper():\n    drop_ball()',
      type: 'snippet',
    })
  }

  return dedupeCompletionItems(items)
}
