import { formatText } from '../content'
import type { FeedEntry, GameTask, ShopNodeCopy, UiText } from '../types'

type ActivityFeedProps = {
  entries: FeedEntry[]
  tasks: GameTask[]
  shopNodes: ShopNodeCopy[]
  ui: UiText
}

function getEntryCategory(entry: FeedEntry, ui: UiText): string {
  switch (entry.type) {
    case 'mini_task_solved':
    case 'mini_task_failed':
      return ui.feedCategoryTask
    case 'editor_unlocked':
    case 'line_unlocked':
      return ui.feedCategoryUnlock
    case 'shop_opened':
    case 'upgrade_bought':
      return ui.feedCategoryShop
    default:
      return ui.feedCategoryTutorial
  }
}

function getEntryMessage(
  entry: FeedEntry,
  tasks: GameTask[],
  shopNodes: ShopNodeCopy[],
  ui: UiText,
): string {
  const taskTitle =
    tasks.find((task) => task.id === entry.taskId)?.title ?? entry.taskId ?? ''
  const upgradeTitle =
    shopNodes.find((node) => node.id === entry.upgradeId)?.title ??
    entry.upgradeId ??
    ''

  switch (entry.type) {
    case 'mini_task_solved':
      return formatText(ui.feedMiniTaskSolved, { task: taskTitle })
    case 'mini_task_failed':
      return formatText(ui.feedMiniTaskFailed, { task: taskTitle })
    case 'editor_unlocked':
      return ui.feedEditorUnlocked
    case 'line_unlocked':
      return formatText(ui.feedLineUnlocked, {
        lines: String(entry.lineCapacity ?? 0),
      })
    case 'shop_opened':
      return ui.feedShopOpened
    case 'upgrade_bought':
      return formatText(ui.feedUpgradeBought, {
        upgrade: upgradeTitle,
      })
    default:
      return ''
  }
}

export function ActivityFeed({ entries, tasks, shopNodes, ui }: ActivityFeedProps) {
  const visibleEntries = entries.filter(
    (entry) =>
      entry.type !== 'mini_task_appeared' &&
      entry.type !== 'game_opened' &&
      entry.type !== 'run_hint',
  )

  return (
    <aside className="activity-feed">
      <div className="activity-feed-header">
        <p className="panel-kicker">{ui.activityFeedTitle}</p>
      </div>

      {visibleEntries.length === 0 ? (
        <p className="activity-empty">{ui.activityFeedEmpty}</p>
      ) : (
        <ul className="activity-list">
          {visibleEntries.map((entry) => (
            <li className={`activity-entry ${entry.type}`} key={entry.id}>
              <span className="activity-category">
                {getEntryCategory(entry, ui)}
              </span>
              <p className="activity-message">
                {getEntryMessage(entry, tasks, shopNodes, ui)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
