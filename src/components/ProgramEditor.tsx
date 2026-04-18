import { memo, useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import {
  autocompletion,
  type Completion,
  type CompletionSource,
} from '@codemirror/autocomplete'
import { python } from '@codemirror/lang-python'
import { Decoration, EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import type { UiText } from '../types'
import {
  buildSourceNameCompletions,
  type EditorCompletionItem,
} from '../game/editorCompletions'

type ProgramEditorProps = {
  code: string
  ui: UiText
  title: string
  variant?: 'main' | 'helper'
  status: 'locked' | 'editable' | 'read-only'
  isEditable: boolean
  isHighlighted: boolean
  activeLineNumber: number | null
  lineUsageText: string
  helperText: string | null
  feedbackMessage: string | null
  feedbackTone: 'neutral' | 'success' | 'warning' | 'error'
  completions?: EditorCompletionItem[]
  onChange: (value: string) => void
}

function getLineStartPosition(source: string, lineNumber: number): number {
  if (lineNumber <= 1) {
    return 0
  }

  let currentLine = 1
  let position = 0

  while (currentLine < lineNumber && position < source.length) {
    const nextBreak = source.indexOf('\n', position)

    if (nextBreak === -1) {
      return position
    }

    position = nextBreak + 1
    currentLine += 1
  }

  return position
}

function createExecutionHighlightExtension(
  source: string,
  activeLineNumber: number | null,
) {
  if (activeLineNumber === null) {
    return []
  }

  const lineStart = getLineStartPosition(source, activeLineNumber)
  const decorations = Decoration.set([
    Decoration.line({
      attributes: {
        class: 'cm-executing-line',
      },
    }).range(lineStart),
  ])

  return [EditorView.decorations.of(decorations)]
}

const readOnlyExtensions = [
  python(),
  EditorView.lineWrapping,
  EditorState.readOnly.of(true),
  EditorView.editable.of(false),
]

function filterCompletionOptions(
  options: Completion[],
  prefix: string,
  includeSnippets: boolean,
) {
  const normalizedPrefix = prefix.toLowerCase()

  return options.filter((option) => {
    if (!includeSnippets && option.type === 'snippet') {
      return false
    }

    if (normalizedPrefix === '') {
      return true
    }

    const primary = option.label.toLowerCase()
    const applyText =
      typeof option.apply === 'string'
        ? option.apply.split('\n')[0]?.toLowerCase() ?? ''
        : ''

    return (
      primary.startsWith(normalizedPrefix) ||
      applyText.startsWith(normalizedPrefix)
    )
  })
}

function createEditableExtensions(completions: EditorCompletionItem[]) {
  const staticCompletionOptions: Completion[] = completions.map((item) => ({
    label: item.label,
    apply: item.apply,
    detail: item.detail,
    type: item.type,
  }))
  const completionSource: CompletionSource = (context) => {
    const sourceCompletionOptions: Completion[] = buildSourceNameCompletions(
      context.state.sliceDoc(0, context.pos),
    ).map((item) => ({
      label: item.label,
      apply: item.apply,
      detail: item.detail,
      type: item.type,
    }))
    const completionOptions = [
      ...staticCompletionOptions,
      ...sourceCompletionOptions,
    ]
    const tokenOptions = completionOptions.filter((item) => item.type !== 'snippet')
    const word = context.matchBefore(/[A-Za-z_][A-Za-z0-9_]*/)

    if (word !== null && (word.from !== word.to || context.explicit)) {
      const options = filterCompletionOptions(
        completionOptions,
        word.text,
        true,
      )

      if (options.length === 0 && !context.explicit) {
        return null
      }

      return {
        from: word.from,
        options,
      }
    }

    const line = context.state.doc.lineAt(context.pos)
    const lineBeforeCursor = line.text.slice(0, context.pos - line.from)
    const shouldSuggestTokens =
      /(?:^|\s)(if|elif)\s+$/.test(lineBeforeCursor) ||
      /(==|!=|<=|>=|<|>)\s*$/.test(lineBeforeCursor) ||
      /\(\s*$/.test(lineBeforeCursor) ||
      /=\s*$/.test(lineBeforeCursor)

    if (!shouldSuggestTokens) {
      return context.explicit
        ? {
            from: context.pos,
            options: completionOptions,
          }
        : null
    }

    return {
      from: context.pos,
      options: tokenOptions,
    }
  }

  return [
    python(),
    EditorView.lineWrapping,
    autocompletion({
      override: [completionSource],
      activateOnTyping: true,
      icons: false,
    }),
  ]
}

const editorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#fff9f2',
      color: '#241910',
    },
    '.cm-gutters': {
      backgroundColor: '#f5ede0',
      color: '#8b664d',
      border: 'none',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(44, 93, 80, 0.08)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(44, 93, 80, 0.08)',
    },
    '.cm-content': {
      caretColor: '#2c5d50',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#2c5d50',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(216, 102, 47, 0.18)',
    },
  },
  { dark: false },
)

function areCompletionItemsEqual(
  previous: EditorCompletionItem[] | undefined,
  next: EditorCompletionItem[] | undefined,
) {
  const previousItems = previous ?? []
  const nextItems = next ?? []

  if (previousItems.length !== nextItems.length) {
    return false
  }

  return previousItems.every((item, index) => {
    const nextItem = nextItems[index]

    return (
      nextItem !== undefined &&
      item.label === nextItem.label &&
      item.apply === nextItem.apply &&
      item.detail === nextItem.detail &&
      item.type === nextItem.type
    )
  })
}

function ProgramEditorComponent({
  code,
  ui,
  title,
  variant = 'main',
  status,
  isEditable,
  isHighlighted,
  activeLineNumber,
  lineUsageText,
  helperText,
  feedbackMessage,
  feedbackTone,
  completions = [],
  onChange,
}: ProgramEditorProps) {
  const executionHighlightExtension = useMemo(
    () => createExecutionHighlightExtension(code, activeLineNumber),
    [code, activeLineNumber],
  )
  const editableExtensions = useMemo(
    () => createEditableExtensions(completions),
    [completions],
  )
  const editorExtensions = useMemo(
    () => [
      ...(isEditable ? editableExtensions : readOnlyExtensions),
      editorTheme,
      ...executionHighlightExtension,
    ],
    [editableExtensions, executionHighlightExtension, isEditable],
  )
  const statusLabel =
    status === 'editable'
      ? ui.editorUnlockedTitle
      : status === 'read-only'
        ? ui.editorReadOnlyTitle
        : ui.editorLockedTitle

  return (
    <section
      className={`editor-shell ${variant}-editor${isHighlighted ? ' tutorial-target' : ''}`}
      aria-label={title}
    >
      <div className="terminal-bar">
        <span />
        <span />
        <span />
      </div>
      <div className="editor-header">
        <div className="editor-title-group">
          <h2>{title}</h2>
          {helperText !== null && helperText.trim() !== '' ? (
            <p className="editor-help">{helperText}</p>
          ) : null}
        </div>
        <div className="editor-badges">
          <span className="editor-line-badge">{lineUsageText}</span>
          <span
            className={`editor-lock-badge${
              status === 'editable'
                ? ' unlocked'
                : status === 'read-only'
                  ? ' readonly'
                  : ''
            }`}
          >
            {statusLabel}
          </span>
        </div>
      </div>
      <>
        <CodeMirror
          value={code}
          editable={isEditable}
          onChange={onChange}
          basicSetup={{
            foldGutter: false,
            dropCursor: false,
            allowMultipleSelections: false,
            autocompletion: false,
            indentOnInput: false,
            lineNumbers: true,
            highlightActiveLine: isEditable,
            highlightActiveLineGutter: isEditable,
          }}
          extensions={editorExtensions}
          className="code-editor"
        />
        {feedbackMessage !== null ? (
          <p className={`editor-feedback ${feedbackTone}`} aria-live="polite">
            {feedbackMessage}
          </p>
        ) : null}
      </>
    </section>
  )
}

export const ProgramEditor = memo(
  ProgramEditorComponent,
  (previousProps, nextProps) =>
    previousProps.code === nextProps.code &&
    previousProps.ui === nextProps.ui &&
    previousProps.title === nextProps.title &&
    previousProps.variant === nextProps.variant &&
    previousProps.status === nextProps.status &&
    previousProps.isEditable === nextProps.isEditable &&
    previousProps.isHighlighted === nextProps.isHighlighted &&
    previousProps.activeLineNumber === nextProps.activeLineNumber &&
    previousProps.lineUsageText === nextProps.lineUsageText &&
    previousProps.helperText === nextProps.helperText &&
    previousProps.feedbackMessage === nextProps.feedbackMessage &&
    previousProps.feedbackTone === nextProps.feedbackTone &&
    previousProps.onChange === nextProps.onChange &&
    areCompletionItemsEqual(previousProps.completions, nextProps.completions),
)
