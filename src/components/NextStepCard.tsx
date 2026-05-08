import { useState } from 'react'
import type { GoalAnswerSection, UiText, UnlockPrimerCard } from '../types'

type NextStepCardProps = {
  ui: UiText
  title: string
  body: string
  progressText: string | null
  progressValue: number | null
  hintText: string | null
  primerCards: UnlockPrimerCard[]
  actionLabel: string | null
  onAction: (() => void) | null
  answerSections?: GoalAnswerSection[]
  onShowAnswer?: (() => void) | null
  highlightAction?: boolean
}

export function NextStepCard({
  ui,
  title,
  body,
  progressText,
  progressValue,
  hintText,
  primerCards,
  actionLabel,
  onAction,
  answerSections = [],
  onShowAnswer = null,
  highlightAction = false,
}: NextStepCardProps) {
  const [openPanel, setOpenPanel] = useState<'hint' | 'answer' | null>(null)
  const hasAnswer = answerSections.length > 0

  const handleShowAnswer = () => {
    if (openPanel === 'answer') {
      setOpenPanel(null)
      return
    }

    onShowAnswer?.()
    setOpenPanel('answer')
  }

  const handleToggleHint = () => {
    setOpenPanel((current) => (current === 'hint' ? null : 'hint'))
  }

  return (
    <section className="objective-bar" aria-label={ui.nextStepLabel}>
      <div className="objective-main">
        <div className="objective-copy">
          <h2 className="objective-title">{title}</h2>
          <p className="objective-body">{body}</p>
        </div>

        <div className="objective-side">
          {progressText !== null && progressValue !== null ? (
            <div className="objective-progress">
              <div className="objective-progress-head">
                <span>{ui.nextStepProgressLabel}</span>
                <strong>{progressText}</strong>
              </div>
              <div className="objective-progress-track" aria-hidden="true">
                <span
                  className="objective-progress-fill"
                  style={{
                    width: `${Math.max(0, Math.min(100, progressValue * 100))}%`,
                  }}
                />
              </div>
            </div>
          ) : null}

          {actionLabel !== null && onAction !== null ? (
            <button
              className={`secondary-button objective-action${
                highlightAction ? ' attention' : ''
              }`}
              onClick={onAction}
              type="button"
            >
              {actionLabel}
            </button>
          ) : null}
        </div>
      </div>

      {primerCards.length > 0 ? (
        <div className="objective-detail-row">
          <article className="objective-detail-card">
            <span>{ui.nextStepPrimerLabel}</span>
            <div className="objective-primer-grid">
              {primerCards.map((card) => (
                <section className="objective-primer-card" key={card.id}>
                  <strong>{card.title}</strong>
                  <p>{card.body}</p>
                  <div className="objective-primer-syntax">
                    <span>{ui.nextStepPrimerSyntaxLabel}</span>
                    <code>{card.syntax}</code>
                  </div>
                </section>
              ))}
            </div>
          </article>
        </div>
      ) : null}

      {hintText !== null || hasAnswer ? (
        <div className="objective-toggle-row">
          {hintText !== null ? (
            <button
              className="ghost-button objective-toggle"
              onClick={handleToggleHint}
              type="button"
            >
              {openPanel === 'hint'
                ? ui.objectiveHideHintButton
                : ui.objectiveShowHintButton}
            </button>
          ) : null}
          {hasAnswer ? (
            <button
              className="ghost-button objective-toggle"
              onClick={handleShowAnswer}
              type="button"
            >
              {ui.goalShowAnswerButton}
            </button>
          ) : null}
        </div>
      ) : null}

      {openPanel !== null ? (
        <div className="objective-detail-row">
          {openPanel === 'hint' && hintText !== null ? (
            <article className="objective-detail-card">
              <p>{hintText}</p>
            </article>
          ) : null}

          {openPanel === 'answer' && hasAnswer ? (
            <article className="objective-detail-card objective-stuck-card">
              <div className="objective-answer-list">
                {answerSections.map((section) => (
                  <div className="objective-answer" key={section.label}>
                    {answerSections.length > 1 ? <strong>{section.label}</strong> : null}
                    <code>{section.code}</code>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
        </div>
      ) : null}

    </section>
  )
}
