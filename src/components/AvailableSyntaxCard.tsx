import type {
  ReferenceExampleItem,
  ReferenceValueItem,
  UiText,
} from '../types'

type AvailableSyntaxCardProps = {
  ui: UiText
  functions: string[]
  structures: string[]
  referenceValues: ReferenceValueItem[]
  examples: ReferenceExampleItem[]
}

export function AvailableSyntaxCard({
  ui,
  functions,
  structures,
  referenceValues,
  examples,
}: AvailableSyntaxCardProps) {
  return (
    <section className="syntax-card" aria-label={ui.referenceTitle}>
      <p className="panel-kicker">{ui.referenceTitle}</p>

      <details className="reference-section" open>
        <summary className="reference-summary">{ui.referenceSectionAvailableLabel}</summary>
        <div className="reference-content">
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
        </div>
      </details>

      <details className="reference-section">
        <summary className="reference-summary">{ui.referenceSectionBoardLabel}</summary>
        <div className="reference-content reference-value-list">
          {referenceValues.map((entry) => (
            <article className="reference-value-card" key={entry.id}>
              <div className="reference-value-header">
                <code>{entry.label}</code>
              </div>
              <p>{entry.description}</p>
              {entry.example !== undefined ? (
                <pre className="reference-inline-example">
                  <code>{entry.example}</code>
                </pre>
              ) : null}
            </article>
          ))}
        </div>
      </details>

      <details className="reference-section">
        <summary className="reference-summary">{ui.referenceSectionExamplesLabel}</summary>
        <div className="reference-content">
          {examples.length === 0 ? (
            <p className="syntax-empty">{ui.referenceNoExamples}</p>
          ) : (
            <div className="reference-example-list">
              {examples.map((entry) => (
                <article className="reference-example-card" key={entry.id}>
                  <span className="syntax-group-label">{entry.label}</span>
                  <pre className="reference-example-code">
                    <code>{entry.code}</code>
                  </pre>
                </article>
              ))}
            </div>
          )}
        </div>
      </details>
    </section>
  )
}
