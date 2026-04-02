import type {
  GameState,
  ShopNodeDefinition,
  ShopNodeId,
  ShopNodeStatus,
} from '../types'

export const SHOP_NODES: ShopNodeDefinition[] = [
  {
    id: 'editor_unlock',
    kind: 'milestone',
    cost: 0,
    implemented: true,
    lineCapacity: 2,
  },
  {
    id: 'line_capacity_3',
    kind: 'upgrade',
    cost: 20,
    implemented: true,
    lineCapacity: 3,
  },
  {
    id: 'for_loop',
    kind: 'syntax',
    cost: 45,
    implemented: true,
    unlockConstruct: 'for',
  },
  {
    id: 'variables',
    kind: 'syntax',
    cost: 60,
    implemented: false,
  },
  {
    id: 'if_statement',
    kind: 'syntax',
    cost: 85,
    implemented: false,
  },
  {
    id: 'while_loop',
    kind: 'syntax',
    cost: 120,
    implemented: false,
  },
  {
    id: 'functions',
    kind: 'syntax',
    cost: 150,
    implemented: false,
  },
  {
    id: 'lists',
    kind: 'syntax',
    cost: 180,
    implemented: false,
  },
]

export function canOpenShop(state: GameState): boolean {
  return state.unlocks.editorEditable
}

export function getShopNodeStatus(
  state: GameState,
  node: ShopNodeDefinition,
): ShopNodeStatus {
  if (node.id === 'editor_unlock') {
    return state.unlocks.editorEditable ? 'completed' : 'locked'
  }

  if (state.purchasedUpgradeIds.includes(node.id)) {
    return 'completed'
  }

  if (node.id === 'line_capacity_3' && state.unlocks.editorEditable) {
    return 'available'
  }

  if (
    node.id === 'for_loop' &&
    state.purchasedUpgradeIds.includes('line_capacity_3')
  ) {
    return 'available'
  }

  return node.implemented ? 'locked' : 'preview'
}

export function canPurchaseShopNode(
  state: GameState,
  nodeId: ShopNodeId,
): boolean {
  const node = SHOP_NODES.find((entry) => entry.id === nodeId)

  if (node === undefined || !node.implemented) {
    return false
  }

  if (getShopNodeStatus(state, node) !== 'available') {
    return false
  }

  return state.score >= node.cost
}
