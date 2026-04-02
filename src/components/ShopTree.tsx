import { formatText } from '../content'
import { canPurchaseShopNode, getShopNodeStatus, SHOP_NODES } from '../game/shop'
import type { GameState, ShopNodeCopy, ShopNodeDefinition, ShopNodeStatus, UiText } from '../types'

type ShopTreeProps = {
  gameState: GameState
  shopNodes: ShopNodeCopy[]
  ui: UiText
  onPurchase: (nodeId: ShopNodeDefinition['id']) => void
}

function getNodeCopy(shopNodes: ShopNodeCopy[], nodeId: ShopNodeDefinition['id']) {
  return shopNodes.find((entry) => entry.id === nodeId)
}

function getStatusLabel(status: ShopNodeStatus, ui: UiText): string {
  switch (status) {
    case 'completed':
      return ui.shopNodeCompleted
    case 'available':
      return ui.shopNodeAvailable
    case 'preview':
      return ui.shopNodePreview
    default:
      return ui.shopNodeLocked
  }
}

export function ShopTree({
  gameState,
  shopNodes,
  ui,
  onPurchase,
}: ShopTreeProps) {
  return (
    <section className="shop-shell" aria-label={ui.shopTitle}>
      <div className="shop-header">
        <div>
          <p className="panel-kicker">{ui.shopTitle}</p>
          <h2 className="shop-heading">{ui.shopSubtitle}</h2>
        </div>
        <div className="shop-score-card">
          <span>{ui.shopScoreLabel}</span>
          <strong>{gameState.score}</strong>
        </div>
      </div>

      <div className="skill-tree">
        {SHOP_NODES.map((node) => {
          const copy = getNodeCopy(shopNodes, node.id)
          const status = getShopNodeStatus(gameState, node)
          const canPurchase = canPurchaseShopNode(gameState, node.id)
          const isPurchased = gameState.purchasedUpgradeIds.includes(node.id)
          const purchaseLabel = formatText(ui.shopBuyButton, {
            cost: String(node.cost),
          })

          return (
            <article
              className={`skill-node ${status}`}
              key={node.id}
            >
              <div className="skill-node-top">
                <span className="skill-node-status">
                  {getStatusLabel(status, ui)}
                </span>
                {node.cost > 0 ? (
                  <span className="skill-node-cost">
                    {formatText(ui.shopCostValue, { cost: String(node.cost) })}
                  </span>
                ) : null}
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
                    {isPurchased ? ui.shopBoughtButton : purchaseLabel}
                  </button>
                  {!canPurchase ? (
                    <span className="skill-node-hint">{ui.shopAvailableHint}</span>
                  ) : null}
                </div>
              ) : status === 'preview' ? (
                <p className="skill-node-hint">{ui.shopPreviewMessage}</p>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}
