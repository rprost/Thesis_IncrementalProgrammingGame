import type { UiText } from '../types'

type NextStepCardProps = {
  ui: UiText
  title: string
  body: string
  stageLabel: string
  progressText: string | null
  progressValue: number | null
  actionLabel: string | null
  onAction: (() => void) | null
}

export function NextStepCard({
  ui,
  title,
  body,
  stageLabel,
  progressText,
  progressValue,
  actionLabel,
  onAction,
}: NextStepCardProps) {
  return (
    <section className="next-step-card" aria-label={ui.nextStepLabel}>
      <div className="next-step-header">
        <div>
          <p className="panel-kicker">{ui.nextStepLabel}</p>
          <h2 className="next-step-title">{title}</h2>
        </div>
        <span className="next-step-stage">{stageLabel}</span>
      </div>

      <p className="next-step-body">{body}</p>

      {progressText !== null && progressValue !== null ? (
        <div className="next-step-progress">
          <div className="next-step-progress-header">
            <span>{ui.nextStepProgressLabel}</span>
            <strong>{progressText}</strong>
          </div>
          <div className="next-step-progress-track" aria-hidden="true">
            <span
              className="next-step-progress-fill"
              style={{
                width: `${Math.max(0, Math.min(100, progressValue * 100))}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {actionLabel !== null && onAction !== null ? (
        <button
          className="secondary-button next-step-action"
          onClick={onAction}
          type="button"
        >
          {actionLabel}
        </button>
      ) : null}
    </section>
  )
}
