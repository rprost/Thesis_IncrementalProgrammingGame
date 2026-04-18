import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import { Decoration, EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import type { UiText } from '../types'

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

const editableExtensions = [python(), EditorView.lineWrapping]
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

export function ProgramEditor({
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
  onChange,
}: ProgramEditorProps) {
  const executionHighlightExtension = createExecutionHighlightExtension(
    code,
    activeLineNumber,
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
            indentOnInput: false,
            lineNumbers: true,
            highlightActiveLine: isEditable,
            highlightActiveLineGutter: isEditable,
          }}
          extensions={[
            ...(isEditable ? editableExtensions : readOnlyExtensions),
            editorTheme,
            ...executionHighlightExtension,
          ]}
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
