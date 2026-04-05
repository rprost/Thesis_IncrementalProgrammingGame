import { useState } from 'react'
import type { GameTask, TaskArchetype, UiText } from '../types'

type TaskModalProps = {
  task: GameTask | null
  ui: UiText
  progressText: string | null
  onResolved: (wasCorrect: boolean, task: GameTask) => void
}

type TaskFeedback = {
  title: string
  description: string
  wasCorrect: boolean
}

function getArchetypeLabel(archetype: TaskArchetype, ui: UiText): string {
  switch (archetype) {
    case 'read':
      return ui.taskReadLabel
    case 'choose':
      return ui.taskChooseLabel
    case 'repair':
      return ui.taskRepairLabel
    default:
      return ui.taskReadLabel
  }
}

export function TaskModal({
  task,
  ui,
  progressText,
  onResolved,
}: TaskModalProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<TaskFeedback | null>(null)
  const [showHints, setShowHints] = useState(false)

  if (task === null) {
    return null
  }

  const handleSubmit = () => {
    if (selectedOption === null) {
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

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-title"
      >
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
          </div>
        </div>

        <p className="modal-question">{task.question}</p>

        <pre className="modal-code">
          <code>{task.code}</code>
        </pre>

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
              <span>{ui.taskBoardHintLabel}</span>
              <p>{task.boardHint}</p>
            </article>
            <article className="task-guidance-card">
              <span>{ui.taskUnlockConnectionLabel}</span>
              <p>{task.unlockConnection}</p>
            </article>
          </div>
        ) : null}

        <div className="options-list">
          {task.options.map((option, index) => {
            const isSelected = selectedOption === index

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
                />
                <span>{option}</span>
              </label>
            )
          })}
        </div>

        {feedback !== null ? (
          <div
            className={`feedback-box ${feedback.wasCorrect ? 'success' : 'error'}`}
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
            disabled={selectedOption === null}
            type="button"
          >
            {ui.submitButton}
          </button>
        )}
      </div>
    </div>
  )
}
