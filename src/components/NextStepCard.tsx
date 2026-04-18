import { useState } from 'react'
import type { UiText, UnlockPrimerCard } from '../types'

type NextStepCardProps = {
  ui: UiText
  title: string
  body: string
  stageLabel: string
  progressText: string | null
  progressValue: number | null
  hintText: string | null
  primerCards: UnlockPrimerCard[]
  actionLabel: string | null
  onAction: (() => void) | null
  highlightAction?: boolean
}

export function NextStepCard({
  ui,
  title,
  body,
  stageLabel,
  progressText,
  progressValue,
  hintText,
  primerCards,
  actionLabel,
  onAction,
  highlightAction = false,
}: NextStepCardProps) {
  const [showHint, setShowHint] = useState(false)

  return (
    <section className="objective-bar" aria-label={ui.nextStepLabel}>
      <div className="objective-main">
        <div className="objective-copy">
          <div className="objective-meta">
            <p className="panel-kicker">{ui.nextStepLabel}</p>
            <span className="objective-stage">{stageLabel}</span>
          </div>
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

      {hintText !== null ? (
        <div className="objective-toggle-row">
          <button
            className="ghost-button objective-toggle"
            onClick={() => setShowHint((current) => !current)}
            type="button"
          >
            {showHint ? ui.objectiveHideHintButton : ui.objectiveShowHintButton}
          </button>
        </div>
      ) : null}

      {showHint ? (
        <div className="objective-detail-row">
          {hintText !== null ? (
            <article className="objective-detail-card">
              <p>{hintText}</p>
            </article>
          ) : null}
        </div>
      ) : null}

    </section>
  )
}
