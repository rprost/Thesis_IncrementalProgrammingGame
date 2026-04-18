import { formatText } from '../content'
import type { BallType, PortalSide, UiText } from '../types'

type BoardInternalsPanelProps = {
  ui: UiText
  portalActive: boolean
  portalSide: PortalSide
  upcomingBalls: BallType[]
  scenarioPreviewCount: number | null
  bonusMap: number[] | null
}

function getBallTypeLabel(ballType: BallType, ui: UiText): string {
  switch (ballType) {
    case 'plain':
      return ui.boardBallTypePlain
    case 'portal':
      return ui.boardBallTypeLucky
    case 'negative':
      return ui.boardBallTypeEvil
    case 'center':
    default:
      return ui.boardBallTypeNormal
  }
}

function getBallTypeConstant(ballType: BallType): string {
  switch (ballType) {
    case 'plain':
      return 'ball'
    case 'portal':
      return 'portal_ball'
    case 'negative':
      return 'negative_ball'
    case 'center':
    default:
      return 'center_ball'
  }
}

function getLaneLabel(lane: PortalSide, ui: UiText): string {
  return lane === 1 ? ui.boardLaneLeft : ui.boardLaneRight
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value)
}

function formatBonusMap(values: number[]): string {
  return `[${values.map((value) => formatNumber(value)).join(', ')}]`
}

export function BoardInternalsPanel({
  ui,
  portalActive,
  portalSide,
  upcomingBalls,
  scenarioPreviewCount,
  bonusMap,
}: BoardInternalsPanelProps) {
  const hasPreview = upcomingBalls.length > 0
  const hasBonusMap = bonusMap !== null
  const showsOnlyNeutralPreview =
    hasPreview && upcomingBalls.every((ballType) => ballType === 'plain')
  const showNextBallCode =
    hasPreview && (upcomingBalls[0] ?? 'plain') !== 'plain'
  const highestMultiplier =
    bonusMap !== null && bonusMap.length > 0 ? Math.max(...bonusMap) : null

  if (!hasPreview && !portalActive && !hasBonusMap) {
    return null
  }

  return (
    <section className="board-internals-panel" aria-label={ui.boardInternalsTitle}>
      <div className="board-internals-header">
        <p className="panel-kicker">{ui.boardInternalsTitle}</p>
      </div>

      <div className="board-internals-grid">
        {hasPreview ? (
          <article className="board-internal-card">
            <span className="board-internal-label">
              {upcomingBalls.length === 1
                ? ui.boardNextBallLabel
                : ui.boardUpcomingBallsLabel}
            </span>
            {showsOnlyNeutralPreview ? (
              <div className="board-preview-list compact">
                <span className="board-preview-pill type-plain subdued neutral-summary">
                  <span className="board-preview-dot" aria-hidden="true" />
                  {formatText(ui.boardNeutralPreviewCountValue, {
                    count: String(upcomingBalls.length),
                  })}
                </span>
              </div>
            ) : (
              <>
                <div className="board-preview-list compact">
                  {upcomingBalls.map((ballType, index) => (
                    <span
                      className={`board-preview-pill type-${ballType}${
                        scenarioPreviewCount !== null &&
                        index >= scenarioPreviewCount
                          ? ' subdued'
                          : ''
                      }`}
                      key={`${ballType}-${index}`}
                    >
                      <span className="board-preview-dot" aria-hidden="true" />
                      {getBallTypeLabel(ballType, ui)}
                    </span>
                  ))}
                </div>
                {showNextBallCode ? (
                  <code className="board-internal-code">
                    {formatText(ui.boardNextBallCodeValue, {
                      value: getBallTypeConstant(upcomingBalls[0] ?? 'plain'),
                    })}
                  </code>
                ) : null}
              </>
            )}
          </article>
        ) : null}

        {portalActive ? (
          <article className="board-internal-card">
            <span className="board-internal-label">{ui.boardActivePortalLabel}</span>
            <strong className="board-internal-value">
              {formatText(ui.boardActivePortalValue, {
                label: getLaneLabel(portalSide, ui),
                value: String(portalSide),
              })}
            </strong>
            <code className="board-internal-code">
              {formatText(ui.boardPortalCodeValue, {
                value: String(portalSide),
              })}
            </code>
          </article>
        ) : null}

        {hasBonusMap ? (
          <article className="board-internal-card">
            <span className="board-internal-label">{ui.boardMultipliersLabel}</span>
            <div className="board-bonus-map-pills">
              {bonusMap.map((value, index) => (
                <span
                  className={`board-bonus-pill${
                    value === highestMultiplier ? ' best' : ''
                  }`}
                  key={`bonus-map-${index + 1}`}
                >
                  <strong className="board-bonus-pill-index">{index + 1}</strong>
                  <span className="board-bonus-pill-value">
                    x{formatNumber(value)}
                  </span>
                </span>
              ))}
            </div>
            <code className="board-internal-code">
              {formatText(ui.boardBonusMapCodeValue, {
                value: formatBonusMap(bonusMap),
              })}
            </code>
          </article>
        ) : null}
      </div>
    </section>
  )
}
