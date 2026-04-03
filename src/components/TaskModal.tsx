import { useState } from 'react'
import type { GameTask, UiText } from '../types'
import { TutorialSpotlight } from './TutorialSpotlight'

type TaskModalProps = {
  task: GameTask | null
  ui: UiText
  tutorialTitle: string | null
  tutorialMessage: string | null
  onDismissTutorial: () => void
  onResolved: (wasCorrect: boolean, task: GameTask) => void
}

type TaskFeedback = {
  title: string
  description: string
  wasCorrect: boolean
}

export function TaskModal({
  task,
  ui,
  tutorialTitle,
  tutorialMessage,
  onDismissTutorial,
  onResolved,
}: TaskModalProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<TaskFeedback | null>(null)

  if (task === null) {
    return null
  }

  const handleSubmit = () => {
    if (selectedOption === null) {
      return
    }

    const wasCorrect = selectedOption === task.correctOption

    if (wasCorrect) {
      setFeedback({
        title: ui.correctTitle,
        description: `${task.successMessage} ${ui.rewardLabel} +${task.rewardPoints} ${ui.pointsSuffix}, +${task.rewardMultiplier}x.`,
        wasCorrect: true,
      })
      return
    }

    setFeedback({
      title: ui.incorrectTitle,
      description: `${task.failureMessage} ${ui.penaltyLabel} -${task.penaltyPoints} ${ui.pointsSuffix}, ${ui.multiplierResetMessage}.`,
      wasCorrect: false,
    })
  }

  const handleContinue = () => {
    if (feedback === null) {
      return
    }

    const wasCorrect = feedback.wasCorrect
    onResolved(wasCorrect, task)

    if (!wasCorrect) {
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
        <p className="modal-kicker">{ui.challengeLabel}</p>
        {tutorialTitle !== null && tutorialMessage !== null ? (
          <TutorialSpotlight
            label={ui.tutorialLabel}
            title={tutorialTitle}
            message={tutorialMessage}
            dismissLabel={ui.tutorialDismissButton}
            onDismiss={onDismissTutorial}
          />
        ) : null}
        <h2 id="task-title">{task.title}</h2>
        <p className="modal-question">{task.question}</p>

        <pre className="modal-code">
          <code>{task.code}</code>
        </pre>

        <div className="options-list">
          {task.options.map((option, index) => {
            const isSelected = selectedOption === index
            return (
              <label
                className={`option-card${isSelected ? ' selected' : ''}`}
                key={option}
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
            <button className="secondary-button" onClick={handleContinue}>
              {feedback.wasCorrect ? ui.continueButton : ui.retryButton}
            </button>
          </div>
        ) : (
          <button
            className="secondary-button"
            onClick={handleSubmit}
            disabled={selectedOption === null}
          >
            {ui.submitButton}
          </button>
        )}
      </div>
    </div>
  )
}
