import type {
  GameState,
  GameTask,
  ShopNodeDefinition,
  ShopNodeId,
  ShopNodeStatus,
  TaskTopicId,
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
    cost: 60,
    implemented: true,
    lineCapacity: 3,
  },
  {
    id: 'variables',
    kind: 'syntax',
    cost: 120,
    implemented: true,
    unlockConstruct: 'variables',
    unlockCommand: 'set_aim',
    requiredTopicIds: ['variables'],
    requiredNodeIds: ['line_capacity_3'],
  },
  {
    id: 'if_statement',
    kind: 'syntax',
    cost: 180,
    implemented: true,
    unlockConstruct: 'if',
    requiredTopicIds: ['conditions'],
    requiredNodeIds: ['variables'],
  },
  {
    id: 'functions',
    kind: 'syntax',
    cost: 260,
    implemented: true,
    unlockConstruct: 'functions',
    requiredTopicIds: ['functions'],
    requiredNodeIds: ['if_statement'],
  },
  {
    id: 'for_loop',
    kind: 'syntax',
    cost: 360,
    implemented: true,
    unlockConstruct: 'for',
    requiredTopicIds: ['loops'],
    requiredNodeIds: ['functions'],
  },
  {
    id: 'while_loop',
    kind: 'syntax',
    cost: 300,
    implemented: false,
  },
  {
    id: 'lists',
    kind: 'syntax',
    cost: 360,
    implemented: false,
  },
]

function isTopicMastered(
  state: GameState,
  tasks: GameTask[],
  topicId: TaskTopicId,
): boolean {
  const topicTasks = tasks.filter((task) => task.topicId === topicId)

  if (topicTasks.length === 0) {
    return false
  }

  const solvedTaskIds = new Set(state.solvedTaskIds)
  return topicTasks.every((task) => solvedTaskIds.has(task.id))
}

function areTopicRequirementsMet(
  state: GameState,
  tasks: GameTask[],
  topicIds: TaskTopicId[] | undefined,
): boolean {
  if (topicIds === undefined || topicIds.length === 0) {
    return true
  }

  return topicIds.every((topicId) => isTopicMastered(state, tasks, topicId))
}

function areNodeRequirementsMet(
  state: GameState,
  nodeIds: ShopNodeId[] | undefined,
): boolean {
  if (nodeIds === undefined || nodeIds.length === 0) {
    return true
  }

  return nodeIds.every((nodeId) => state.purchasedUpgradeIds.includes(nodeId))
}

function isNodeCompletedByMilestone(state: GameState, node: ShopNodeDefinition): boolean {
  if (node.id === 'editor_unlock') {
    return state.unlocks.editorEditable
  }

  return false
}

export function canOpenShop(state: GameState): boolean {
  return state.unlocks.editorEditable
}

export function getShopNodeStatus(
  state: GameState,
  node: ShopNodeDefinition,
  tasks: GameTask[],
): ShopNodeStatus {
  if (isNodeCompletedByMilestone(state, node)) {
    return 'completed'
  }

  if (state.purchasedUpgradeIds.includes(node.id)) {
    return 'completed'
  }

  if (!node.implemented) {
    return 'preview'
  }

  if (
    !canOpenShop(state) ||
    !areNodeRequirementsMet(state, node.requiredNodeIds) ||
    !areTopicRequirementsMet(state, tasks, node.requiredTopicIds)
  ) {
    return 'locked'
  }

  return node.cost > 0 ? 'available' : 'locked'
}

export function canPurchaseShopNode(
  state: GameState,
  nodeId: ShopNodeId,
  tasks: GameTask[],
): boolean {
  const node = SHOP_NODES.find((entry) => entry.id === nodeId)

  if (node === undefined || !node.implemented || node.cost <= 0) {
    return false
  }

  if (getShopNodeStatus(state, node, tasks) !== 'available') {
    return false
  }

  return state.score >= node.cost
}
