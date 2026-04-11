import type {
  GameState,
  ShopNodeStatus,
  SupportUpgradeDefinition,
  SupportUpgradeEffects,
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
    id: 'extra_portal_split',
    kind: 'scoring',
    cost: 70,
    requiredTopicId: 'variables',
    extraPortalChildren: 1,
  },
  {
    id: 'queue_peek',
    kind: 'visibility',
    cost: 90,
    requiredTopicId: 'conditions',
    previewCountBonus: 2,
  },
  {
    id: 'center_bin_bonus',
    kind: 'scoring',
    cost: 120,
    requiredTopicId: 'conditions',
    extraCenterBinBonus: 5,
  },
  {
    id: 'helper_line_capacity',
    kind: 'capacity',
    cost: 140,
    requiredTopicId: 'functions',
    helperLineCapacityBonus: 2,
  },
  {
    id: 'portal_chain_once',
    kind: 'automation',
    cost: 190,
    requiredTopicId: 'loops',
    maxPortalDepth: 2,
  },
]

const BASE_SUPPORT_EFFECTS: SupportUpgradeEffects = {
  mainLineCapacityBonus: 0,
  helperLineCapacityBonus: 0,
  previewCount: 1,
  extraPortalChildren: 0,
  extraCenterBinBonus: 0,
  maxPortalDepth: 1,
  ambientDropIntervalMs: null,
}

export function getSupportUpgradeEffects(
  upgradeIds: SupportUpgradeId[],
): SupportUpgradeEffects {
  return upgradeIds.reduce<SupportUpgradeEffects>((effects, upgradeId) => {
    const node = SHOP_NODES.find((entry) => entry.id === upgradeId)

    if (node === undefined) {
      return effects
    }

    return {
      mainLineCapacityBonus:
        effects.mainLineCapacityBonus + (node.mainLineCapacityBonus ?? 0),
      helperLineCapacityBonus:
        effects.helperLineCapacityBonus + (node.helperLineCapacityBonus ?? 0),
      previewCount: effects.previewCount + (node.previewCountBonus ?? 0),
      extraPortalChildren:
        effects.extraPortalChildren + (node.extraPortalChildren ?? 0),
      extraCenterBinBonus:
        effects.extraCenterBinBonus + (node.extraCenterBinBonus ?? 0),
      maxPortalDepth: Math.max(
        effects.maxPortalDepth,
        node.maxPortalDepth ?? effects.maxPortalDepth,
      ),
      ambientDropIntervalMs:
        node.ambientDropIntervalMs ?? effects.ambientDropIntervalMs,
    }
  }, BASE_SUPPORT_EFFECTS)
}

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
