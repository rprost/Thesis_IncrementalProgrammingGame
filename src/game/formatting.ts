import type { BallType, BonusMap } from '../types'

export function formatNumber(value: number): string {
  return String(value)
}

export function formatBonusMapValue(values: BonusMap): string {
  return `[${values.map((value) => formatNumber(value)).join(', ')}]`
}

export function getBallTypeConstant(ballType: BallType): string {
  switch (ballType) {
    case 'plain':
      return 'ball'
    case 'portal':
      return 'portal_ball'
    case 'negative':
      return 'negative_ball'
    case 'center':
      return 'center_ball'
  }
}
