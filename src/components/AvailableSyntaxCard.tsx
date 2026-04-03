import type { UiText } from '../types'

type AvailableSyntaxCardProps = {
  ui: UiText
  functions: string[]
  structures: string[]
  readableValues: string[]
  limits: string[]
}

export function AvailableSyntaxCard({
  ui,
  functions,
  structures,
  readableValues,
  limits,
}: AvailableSyntaxCardProps) {
  return (
    <section className="syntax-card" aria-label={ui.availableSyntaxTitle}>
      <p className="panel-kicker">{ui.availableSyntaxTitle}</p>

      <div className="syntax-group">
        <span className="syntax-group-label">{ui.availableFunctionsLabel}</span>
        <div className="syntax-chip-list">
          {functions.map((entry) => (
            <code className="syntax-chip" key={entry}>
              {entry}
            </code>
          ))}
        </div>
      </div>

      <div className="syntax-group">
        <span className="syntax-group-label">{ui.availableStructuresLabel}</span>
        {structures.length === 0 ? (
          <p className="syntax-empty">{ui.availableStructuresEmpty}</p>
        ) : (
          <div className="syntax-chip-list">
            {structures.map((entry) => (
              <code className="syntax-chip" key={entry}>
                {entry}
              </code>
            ))}
          </div>
        )}
      </div>

      <div className="syntax-group">
        <span className="syntax-group-label">{ui.availableReadableValuesLabel}</span>
        <div className="syntax-chip-list">
          {readableValues.map((entry) => (
            <code className="syntax-chip" key={entry}>
              {entry}
            </code>
          ))}
        </div>
      </div>

      <div className="syntax-group">
        <span className="syntax-group-label">{ui.availableLimitsLabel}</span>
        <ul className="syntax-limit-list">
          {limits.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
