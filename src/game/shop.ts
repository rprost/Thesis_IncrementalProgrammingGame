import type {
  GameState,
  ShopNodeStatus,
  SupportUpgradeDefinition,
  SupportUpgradeId,
} from '../types'

export const SHOP_NODES: SupportUpgradeDefinition[] = [
  {
    id: 'extra_line',
    kind: 'capacity',
    cost: 40,
    requiredTopicId: 'variables',
    mainLineCapacityBonus: 1,
  },
  {
    id: 'gate_preview',
    kind: 'visibility',
    cost: 70,
    requiredTopicId: 'conditions',
  },
  {
    id: 'return_gate_hold',
    kind: 'reliability',
    cost: 90,
    requiredTopicId: 'conditions',
  },
  {
    id: 'helper_line_capacity',
    kind: 'capacity',
    cost: 95,
    requiredTopicId: 'functions',
    helperLineCapacityBonus: 2,
  },
  {
    id: 'relay_bonus',
    kind: 'conversion',
    cost: 110,
    requiredTopicId: 'functions',
  },
  {
    id: 'feeder_persistence',
    kind: 'reliability',
    cost: 120,
    requiredTopicId: 'loops',
  },
  {
    id: 'lightning_bonus',
    kind: 'conversion',
    cost: 140,
    requiredTopicId: 'loops',
  },
]

export function canOpenShop(state: GameState): boolean {
  return state.unlocks.editorEditable
}

function hasLearnedTopic(
  state: GameState,
  topicId: SupportUpgradeDefinition['requiredTopicId'],
): boolean {
  return state.learnedTopicIds.includes(topicId)
}

export function getShopNodeStatus(
  state: GameState,
  node: SupportUpgradeDefinition,
): ShopNodeStatus {
  if (state.supportUpgradeIds.includes(node.id)) {
    return 'completed'
  }

  if (!canOpenShop(state) || !hasLearnedTopic(state, node.requiredTopicId)) {
    return 'locked'
  }

  return 'available'
}

export function canPurchaseShopNode(
  state: GameState,
  nodeId: SupportUpgradeId,
): boolean {
  const node = SHOP_NODES.find((entry) => entry.id === nodeId)

  if (node === undefined) {
    return false
  }

  if (getShopNodeStatus(state, node) !== 'available') {
    return false
  }

  return state.score >= node.cost
}

export function getMainLineCapacityBonus(
  upgradeIds: SupportUpgradeId[],
): number {
  return upgradeIds.reduce((total, upgradeId) => {
    const node = SHOP_NODES.find((entry) => entry.id === upgradeId)
    return total + (node?.mainLineCapacityBonus ?? 0)
  }, 0)
}

export function getHelperLineCapacityBonus(
  upgradeIds: SupportUpgradeId[],
): number {
  return upgradeIds.reduce((total, upgradeId) => {
    const node = SHOP_NODES.find((entry) => entry.id === upgradeId)
    return total + (node?.helperLineCapacityBonus ?? 0)
  }, 0)
}
