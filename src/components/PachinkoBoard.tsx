import {
  BOARD_BUCKET_BOTTOM,
  BOARD_BUCKET_TOP,
  BOARD_BUCKETS,
  BOARD_PIN_ROWS,
  BOARD_VIEWBOX,
  getBallRenderState,
} from '../game/pachinko'
import type {
  ActiveBall,
  BonusLane,
  GameState,
  SideLane,
  SupportUpgradeId,
  TaskTopicId,
  UiText,
} from '../types'

type PachinkoBoardProps = {
  ui: UiText
  activeBalls: ActiveBall[]
  bonusLane: BonusLane
  moduleStates: GameState['moduleStates']
  supportUpgradeIds: SupportUpgradeId[]
  learnedTopicIds: TaskTopicId[]
  now: number
}

function getLaneLabel(lane: BonusLane | SideLane | null, ui: UiText): string {
  switch (lane) {
    case 1:
      return ui.boardLaneLeft
    case 2:
      return ui.boardLaneCenter
    case 3:
      return ui.boardLaneRight
    default:
      return '-'
  }
}

function getLaneCenterX(lane: BonusLane): number {
  switch (lane) {
    case 1:
      return 64
    case 2:
      return 160
    case 3:
    default:
      return 256
  }
}

function getRailX(side: SideLane): number {
  return side === 1 ? 18 : 302
}

function isHighlightedBucket(
  bonusLane: BonusLane,
  bucketId: (typeof BOARD_BUCKETS)[number]['id'],
): boolean {
  if (bonusLane === 1) {
    return bucketId === 'outer_left' || bucketId === 'inner_left'
  }

  if (bonusLane === 2) {
    return bucketId === 'center'
  }

  return bucketId === 'inner_right' || bucketId === 'outer_right'
}

function getBucketPath(centerX: number): string {
  const left = centerX - 28
  const right = centerX + 28
  const bottom = BOARD_BUCKET_BOTTOM
  const top = BOARD_BUCKET_TOP

  return `M ${left} ${top} L ${left} ${bottom} L ${right} ${bottom} L ${right} ${top}`
}

export function PachinkoBoard({
  ui,
  activeBalls,
  bonusLane,
  moduleStates,
  supportUpgradeIds,
  learnedTopicIds,
  now,
}: PachinkoBoardProps) {
  const showConditions = learnedTopicIds.includes('conditions')
  const showFunctions = learnedTopicIds.includes('functions')
  const showLoops = learnedTopicIds.includes('loops')
  const gatePreviewUnlocked = supportUpgradeIds.includes('gate_preview')
  const relayBonusUnlocked = supportUpgradeIds.includes('relay_bonus')
  const lightningBonusUnlocked = supportUpgradeIds.includes('lightning_bonus')
  const feederBulbs = Array.from(
    { length: moduleStates.burst.feederTarget },
    (_, index) => index < moduleStates.burst.feederCharge,
  )
  const lightningReady =
    moduleStates.burst.burstReady || moduleStates.burst.lightningShotsRemaining > 0

  return (
    <section className="board-shell" aria-label={ui.boardTitle}>
      <div className="board-header">
        <div>
          <p className="panel-kicker">{ui.boardTitle}</p>
          <p className="board-subtitle">{ui.boardSubtitle}</p>
        </div>
        <div className={`board-risk lane-${bonusLane}`}>
          <span>{ui.boardBonusLaneLabel}</span>
          <strong>{getLaneLabel(bonusLane, ui)}</strong>
        </div>
      </div>

      <div className="board-stage">
        <svg
          aria-hidden="true"
          className="board-svg"
          viewBox={`0 0 ${BOARD_VIEWBOX.width} ${BOARD_VIEWBOX.height}`}
        >
          {showConditions ? (
            <g className="board-rails">
              {[1, 3].map((side) => {
                const resolvedSide = side as SideLane
                const railRole =
                  moduleStates.diverter.jackpotSide === resolvedSide
                    ? 'jackpot'
                    : 'return'
                const x = getRailX(resolvedSide)
                const label =
                  railRole === 'jackpot'
                    ? ui.boardJackpotSideLabel
                    : ui.boardReturnSideLabel
                const isReturnRail = railRole === 'return'
                const gateX = resolvedSide === 1 ? x + 10 : x - 10

                return (
                  <g
                    className={`board-side-rail ${railRole}${
                      gatePreviewUnlocked ? ' preview' : ''
                    }`}
                    key={`rail-${resolvedSide}`}
                  >
                    <text className="board-side-label" textAnchor="middle" x={x} y="22">
                      {label}
                    </text>
                    <line x1={x} y1="34" x2={x} y2="210" />
                    {isReturnRail ? (
                      <>
                        <rect
                          className={`board-return-gate${
                            moduleStates.diverter.returnGateOpen ? ' open' : ''
                          }`}
                          height="22"
                          rx="10"
                          width="18"
                          x={gateX - 9}
                          y="190"
                        />
                        <text
                          className="board-gate-label"
                          textAnchor="middle"
                          x={gateX}
                          y="228"
                        >
                          {ui.boardReturnGateLabel}
                        </text>
                      </>
                    ) : null}
                  </g>
                )
              })}
            </g>
          ) : null}

          {showLoops ? (
            <g className="board-feeder-ui">
              <text className="board-feeder-label" x="250" y="20">
                {ui.boardBurstTitle}
              </text>
              {feederBulbs.map((isFilled, index) => (
                <circle
                  className={`board-feeder-light${isFilled ? ' filled' : ''}`}
                  cx={228 + index * 18}
                  cy="36"
                  key={`feeder-${index}`}
                  r="5.5"
                />
              ))}
              {lightningReady ? (
                <g className={`board-lightning-badge${lightningBonusUnlocked ? ' boosted' : ''}`}>
                  <rect height="22" rx="11" width="92" x="197" y="48" />
                  <text textAnchor="middle" x="243" y="63">
                    {ui.boardBurstReady}
                  </text>
                </g>
              ) : null}
              <circle
                className="board-combo-target"
                cx={getLaneCenterX(moduleStates.burst.comboTarget)}
                cy="188"
                r="19"
              />
            </g>
          ) : null}

          {showFunctions &&
          moduleStates.relay.relayArmed &&
          moduleStates.relay.relayTargetLane !== null ? (
            <g
              className={`board-echo-target${
                relayBonusUnlocked ? ' boosted' : ''
              }`}
            >
              <text
                className="board-echo-label"
                textAnchor="middle"
                x={getLaneCenterX(moduleStates.relay.relayTargetLane)}
                y="90"
              >
                {ui.boardEchoTargetLabel}
              </text>
              <circle
                cx={getLaneCenterX(moduleStates.relay.relayTargetLane)}
                cy="120"
                r="14"
              />
              <circle
                cx={getLaneCenterX(moduleStates.relay.relayTargetLane)}
                cy="120"
                r="24"
              />
            </g>
          ) : null}

          <circle className="board-launch-dot" cx="160" cy="18" r="5" />

          {BOARD_PIN_ROWS.flat().map((pin, index) => (
            <circle
              className="board-pin"
              cx={pin.x}
              cy={pin.y}
              key={`${pin.x}-${pin.y}-${index}`}
              r="4.5"
            />
          ))}

          {BOARD_BUCKETS.map((bucket) => (
            <g key={bucket.id}>
              <path
                className={`board-bucket-shape${
                  isHighlightedBucket(bonusLane, bucket.id) ? ' highlighted' : ''
                }`}
                d={getBucketPath(bucket.x)}
              />
              <text
                className="board-bucket-points"
                textAnchor="middle"
                x={bucket.x}
                y={BOARD_BUCKET_TOP + 32}
              >
                {bucket.points}
              </text>
            </g>
          ))}

          {activeBalls.map((ball) => {
            const renderState = getBallRenderState(ball, now)

            return (
              <g key={ball.id}>
                <circle
                  className={`board-ball ball-aim-${ball.aim} ${ball.state} ${ball.variant}`}
                  cx={renderState.x}
                  cy={renderState.y}
                  opacity={renderState.opacity}
                  r={renderState.scale * 6}
                />
                {ball.state === 'settled' ? (
                  <text
                    className="board-ball-points"
                    textAnchor="middle"
                    x={renderState.x}
                    y={renderState.y - 16}
                  >
                    +{ball.points}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>
      </div>
    </section>
  )
}
