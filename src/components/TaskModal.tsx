import { useState, type KeyboardEvent } from 'react'
import type { GameTask, ProgramValidation, TaskArchetype, UiText } from '../types'
import { useDialogFocusTrap } from '../useAccessibility'

type TaskModalProps = {
  task: GameTask | null
  isOpen: boolean
  ui: UiText
  progressText: string | null
  onResolved: (wasCorrect: boolean, task: GameTask) => void
  onClose: () => void
  onEvaluated?: (wasCorrect: boolean) => void
  validateWriteAnswer: (
    task: GameTask,
    answer: string,
  ) => {
    passed: boolean
    validation: ProgramValidation | null
    feedbackMessage?: string
  }
  getValidationMessage: (validation: ProgramValidation) => string | null
}

type TaskFeedback = {
  title: string
  description: string
  wasCorrect: boolean
}

function getArchetypeLabel(archetype: TaskArchetype, ui: UiText): string {
  switch (archetype) {
    case 'trace':
      return ui.taskTraceLabel
    case 'choose':
      return ui.taskChooseLabel
    case 'repair':
      return ui.taskRepairLabel
    case 'write':
      return ui.taskWriteLabel
    default:
      return ui.taskTraceLabel
  }
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value)
}

function formatBonusMap(values: number[]): string {
  return `[${values.map((value) => formatNumber(value)).join(', ')}]`
}

export function TaskModal({
  task,
  isOpen,
  ui,
  progressText,
  onResolved,
  onClose,
  onEvaluated,
  validateWriteAnswer,
  getValidationMessage,
}: TaskModalProps) {
  const dialogRef = useDialogFocusTrap<HTMLDivElement>(
    task !== null && isOpen,
    onClose,
  )
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [codeAnswer, setCodeAnswer] = useState(task?.writeValidation?.starterSource ?? '')
  const [feedback, setFeedback] = useState<TaskFeedback | null>(null)
  const [showHints, setShowHints] = useState(false)

  if (task === null || !isOpen) {
    return null
  }

  const handleCodeKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget
    const selectionStart = textarea.selectionStart
    const selectionEnd = textarea.selectionEnd
    const value = codeAnswer

    if (event.key === 'Enter') {
      event.preventDefault()

      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
      const currentLine = value.slice(lineStart, selectionStart)
      const currentIndent = currentLine.match(/^\s*/)?.[0] ?? ''
      const extraIndent = currentLine.trimEnd().endsWith(':') ? '    ' : ''
      const indent = `${currentIndent}${extraIndent}`
      const nextValue =
        value.slice(0, selectionStart) + `\n${indent}` + value.slice(selectionEnd)

      setCodeAnswer(nextValue)
      requestAnimationFrame(() => {
        const nextCaret = selectionStart + 1 + indent.length
        textarea.selectionStart = nextCaret
        textarea.selectionEnd = nextCaret
      })
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    event.preventDefault()

    if (selectionStart === selectionEnd) {
      const indent = event.shiftKey ? '' : '    '

      if (event.shiftKey) {
        const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
        const linePrefix = value.slice(lineStart, selectionStart)
        const removableIndent = linePrefix.endsWith('    ')
          ? 4
          : linePrefix.endsWith(' ')
            ? 1
            : 0

        if (removableIndent === 0) {
          return
        }

        const nextValue =
          value.slice(0, selectionStart - removableIndent) +
          value.slice(selectionEnd)
        setCodeAnswer(nextValue)
        requestAnimationFrame(() => {
          textarea.selectionStart = selectionStart - removableIndent
          textarea.selectionEnd = selectionStart - removableIndent
        })
        return
      }

      const nextValue =
        value.slice(0, selectionStart) + indent + value.slice(selectionEnd)
      setCodeAnswer(nextValue)
      requestAnimationFrame(() => {
        textarea.selectionStart = selectionStart + indent.length
        textarea.selectionEnd = selectionStart + indent.length
      })
      return
    }

    const selectedText = value.slice(selectionStart, selectionEnd)
    const lines = selectedText.split('\n')
    const nextLines = event.shiftKey
      ? lines.map((line) =>
          line.startsWith('    ')
            ? line.slice(4)
            : line.startsWith(' ')
              ? line.slice(1)
              : line,
        )
      : lines.map((line) => `    ${line}`)
    const nextSelectedText = nextLines.join('\n')
    const nextValue =
      value.slice(0, selectionStart) + nextSelectedText + value.slice(selectionEnd)
    setCodeAnswer(nextValue)
    requestAnimationFrame(() => {
      textarea.selectionStart = selectionStart
      textarea.selectionEnd = selectionStart + nextSelectedText.length
    })
  }

  const handleSubmit = () => {
    if (task.archetype === 'write') {
      const result = validateWriteAnswer(task, codeAnswer)

      setFeedback({
        title: result.passed ? ui.correctTitle : ui.incorrectTitle,
        description: result.passed
          ? task.successMessage
          : result.feedbackMessage !== undefined
            ? result.feedbackMessage
          : result.validation !== null
            ? (getValidationMessage(result.validation) ?? ui.taskValidationNeedsRun)
            : task.failureMessage,
        wasCorrect: result.passed,
      })

      if (!result.passed) {
        setShowHints(true)
      }

      onEvaluated?.(result.passed)
      return
    }

    if (selectedOption === null || task.correctOption === undefined) {
      return
    }

    const wasCorrect = selectedOption === task.correctOption

    setFeedback({
      title: wasCorrect ? ui.correctTitle : ui.incorrectTitle,
      description: wasCorrect ? task.successMessage : task.failureMessage,
      wasCorrect,
    })

    if (!wasCorrect) {
      setShowHints(true)
    }

    onEvaluated?.(wasCorrect)
  }

  const handleContinue = () => {
    if (feedback === null) {
      return
    }

    onResolved(feedback.wasCorrect, task)

    if (!feedback.wasCorrect) {
      setSelectedOption(null)
      setFeedback(null)
    }
  }

  const targetLabel =
    task.writeValidation?.target === 'helper'
      ? ui.taskHelperProgramLabel
      : ui.taskMainProgramLabel
  const options = task.options ?? []
  const isWriteTask = task.archetype === 'write'
  const writeCases = task.writeValidation?.cases ?? []
  const visibleWriteCases = writeCases.filter(
    (validationCase) => validationCase.hiddenFromPrompt !== true,
  )
  const writePresentation = task.writeValidation?.presentation ?? { mode: 'cases' as const }

  return (
    <div className="task-sheet-wrap" role="presentation">
      <div
        className="task-sheet"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-title"
        tabIndex={-1}
      >
        <div className="task-sheet-sticky">
          <div className="task-modal-header">
            <div>
              <p className="modal-kicker">{ui.challengeLabel}</p>
              <h2 id="task-title">{task.title}</h2>
            </div>
            <div className="task-modal-badges">
              <span className="task-modal-badge">
                {getArchetypeLabel(task.archetype, ui)}
              </span>
              {progressText !== null ? (
                <span className="task-modal-badge subdued">{progressText}</span>
              ) : null}
              <button
                className="ghost-button task-close-button"
                onClick={onClose}
                type="button"
              >
                {ui.taskCloseButton}
              </button>
            </div>
          </div>
          <p className="modal-question">{task.question}</p>
        </div>

        {task.code.trim().length > 0 ? (
          <div className="task-context-block">
            <span>{ui.taskContextCodeLabel}</span>
            <pre className="modal-code">
              <code>{task.code}</code>
            </pre>
          </div>
        ) : null}

        {isWriteTask && writePresentation.mode === 'summary' ? (
          <div className="task-case-list">
            <span className="task-cases-label">{ui.taskValidationExpectedBehavior}</span>
            <article className="task-case-card task-case-summary">
              <strong>{writePresentation.title}</strong>
              <p>{writePresentation.body}</p>
            </article>
          </div>
        ) : null}

        {isWriteTask &&
        writePresentation.mode === 'cases' &&
        visibleWriteCases.length > 0 ? (
          <div className="task-case-list">
            <span className="task-cases-label">{ui.taskValidationExpectedBehavior}</span>
            <div className="task-case-grid">
              {visibleWriteCases.map((validationCase, index) => {
                const hasStateDetails = validationCase.scenario.bonusMap !== undefined

                return (
                  <article className="task-case-card" key={`${task.id}-case-${index + 1}`}>
                    <strong>{validationCase.title}</strong>
                    {hasStateDetails ? (
                      <div className="task-case-state-list">
                      {validationCase.scenario.bonusMap !== undefined ? (
                        <span>{`${ui.boardMultipliersLabel}: ${formatBonusMap(
                          validationCase.scenario.bonusMap,
                        )}`}</span>
                      ) : null}
                      </div>
                    ) : null}
                    <p>{validationCase.requirement}</p>
                  </article>
                )
              })}
            </div>
          </div>
        ) : null}

        <div className="task-hint-toggle-row">
          <button
            className="ghost-button task-hint-toggle"
            onClick={() => setShowHints((current) => !current)}
            type="button"
          >
            {showHints ? ui.taskHideHintButton : ui.taskShowHintButton}
          </button>
        </div>

        {showHints ? (
          <div className="task-guidance">
            <article className="task-guidance-card">
              <p>{task.boardHint}</p>
            </article>
            {task.unlockConnection.trim().length > 0 ? (
              <article className="task-guidance-card">
                <span>{ui.taskUnlockConnectionLabel}</span>
                <p>{task.unlockConnection}</p>
              </article>
            ) : null}
          </div>
        ) : null}

        {isWriteTask ? (
          <div className="task-write-block">
            <div className="task-answer-header">
              <span>{ui.taskAnswerCodeLabel}</span>
              <strong>{targetLabel}</strong>
            </div>
            <textarea
              className="task-code-entry"
              value={codeAnswer}
              onChange={(event) => setCodeAnswer(event.target.value)}
              onKeyDown={handleCodeKeyDown}
              spellCheck={false}
              aria-label={`${ui.taskAnswerCodeLabel}: ${targetLabel}`}
              data-autofocus="true"
            />
          </div>
        ) : (
          <div className="options-list">
            {options.map((option, index) => {
              const isSelected = selectedOption === index
              const isCodeOption = option.includes('\n')

              return (
                <label
                  className={`option-card${isSelected ? ' selected' : ''}`}
                  key={`${task.id}-${index}`}
                >
                  <input
                    type="radio"
                    name={task.id}
                    checked={isSelected}
                    onChange={() => setSelectedOption(index)}
                    data-autofocus={index === 0 ? 'true' : undefined}
                  />
                  {isCodeOption ? (
                    <pre className="option-code">
                      <code>{option}</code>
                    </pre>
                  ) : (
                    <span>{option}</span>
                  )}
                </label>
              )
            })}
          </div>
        )}

        {feedback !== null ? (
          <div
            className={`feedback-box ${feedback.wasCorrect ? 'success' : 'error'}`}
            aria-live="polite"
          >
            <strong>{feedback.title}</strong>
            <p>{feedback.description}</p>
            <button className="secondary-button" onClick={handleContinue} type="button">
              {feedback.wasCorrect ? ui.continueButton : ui.retryButton}
            </button>
          </div>
        ) : (
          <button
            className="secondary-button"
            onClick={handleSubmit}
            disabled={
              isWriteTask ? codeAnswer.trim().length === 0 : selectedOption === null
            }
            type="button"
          >
            {ui.submitButton}
          </button>
        )}
      </div>
    </div>
  )
}
