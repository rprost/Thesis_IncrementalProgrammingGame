import { PointCostText } from './PointMark'
import { canPurchaseShopNode, getShopNodeStatus, SHOP_NODES } from '../game/shop'
import type {
  GameState,
  SupportUpgradeCopy,
  SupportUpgradeDefinition,
  UiText,
} from '../types'

type ShopTreeProps = {
  gameState: GameState
  shopNodes: SupportUpgradeCopy[]
  ui: UiText
  onPurchase: (nodeId: SupportUpgradeDefinition['id']) => void
}

function getNodeCopy(
  shopNodes: SupportUpgradeCopy[],
  nodeId: SupportUpgradeDefinition['id'],
) {
  return shopNodes.find((entry) => entry.id === nodeId)
}

export function ShopTree({
  gameState,
  shopNodes,
  ui,
  onPurchase,
}: ShopTreeProps) {
  const visibleNodes = SHOP_NODES.filter(
    (node) =>
      gameState.learnedTopicIds.includes(node.requiredTopicId) ||
      gameState.supportUpgradeIds.includes(node.id),
  )

  return (
    <section className="shop-shell" aria-label={ui.shopTitle}>
      <div className="shop-header">
        <div>
          <p className="panel-kicker">{ui.shopTitle}</p>
          <h2 className="shop-heading">{ui.shopSubtitle}</h2>
        </div>
      </div>

      <div className="skill-tree">
        {visibleNodes.map((node) => {
          const copy = getNodeCopy(shopNodes, node.id)
          const status = getShopNodeStatus(gameState, node)
          const canPurchase = canPurchaseShopNode(gameState, node.id)
          const isPurchased = gameState.supportUpgradeIds.includes(node.id)

          return (
            <article className={`skill-node ${status}`} key={node.id}>
              <div className="skill-node-top">
                {status === 'available' ? <span /> : (
                  <span className="skill-node-status">
                    {status === 'completed' ? ui.shopNodeCompleted : ui.shopNodeLocked}
                  </span>
                )}
              </div>

              <h3>{copy?.title ?? node.id}</h3>
              <p>{copy?.description ?? ''}</p>

              {status === 'available' ? (
                <div className="skill-node-footer">
                  <button
                    className="secondary-button"
                    onClick={() => onPurchase(node.id)}
                    disabled={!canPurchase}
                    type="button"
                  >
                    {isPurchased ? (
                      ui.shopBoughtButton
                    ) : (
                      <PointCostText amount={node.cost} template={ui.shopBuyButton} />
                    )}
                  </button>
                </div>
              ) : status === 'locked' ? (
                <p className="skill-node-hint">{ui.shopLockedHint}</p>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}
