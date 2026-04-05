import { formatText } from '../content'
import type {
  FeedEntry,
  GameTask,
  SupportUpgradeCopy,
  TopicDefinition,
  UiText,
} from '../types'

type ActivityFeedProps = {
  entries: FeedEntry[]
  tasks: GameTask[]
  shopNodes: SupportUpgradeCopy[]
  topics: TopicDefinition[]
  ui: UiText
}

function getEntryCategory(entry: FeedEntry, ui: UiText): string {
  switch (entry.type) {
    case 'module_installed':
    case 'checkpoint_ready':
    case 'topic_mastered':
      return ui.feedCategoryModule
    case 'support_upgrade_bought':
    case 'shop_opened':
      return ui.feedCategoryShop
    case 'task_solved':
      return ui.feedCategoryTask
    default:
      return ui.feedCategoryTask
  }
}

function getEntryMessage(
  entry: FeedEntry,
  tasks: GameTask[],
  shopNodes: SupportUpgradeCopy[],
  topics: TopicDefinition[],
  ui: UiText,
): string {
  const taskTitle =
    tasks.find((task) => task.id === entry.taskId)?.title ?? entry.taskId ?? ''
  const upgradeTitle =
    shopNodes.find((node) => node.id === entry.upgradeId)?.title ??
    entry.upgradeId ??
    ''
  const topicTitle =
    topics.find((topic) => topic.id === entry.topicId)?.title ?? entry.topicId ?? ''

  switch (entry.type) {
    case 'module_installed':
      return formatText(ui.feedModuleInstalled, { topic: topicTitle })
    case 'checkpoint_ready':
      return formatText(ui.feedCheckpointReady, { topic: topicTitle })
    case 'task_solved':
      return formatText(ui.feedTaskSolved, { task: taskTitle })
    case 'topic_mastered':
      return formatText(ui.feedTopicMastered, { topic: topicTitle })
    case 'support_upgrade_bought':
      return formatText(ui.feedSupportUpgradeBought, { upgrade: upgradeTitle })
    case 'shop_opened':
      return ui.feedShopOpened
    default:
      return ''
  }
}

export function ActivityFeed({
  entries,
  tasks,
  shopNodes,
  topics,
  ui,
}: ActivityFeedProps) {
  return (
    <aside className="activity-feed">
      <div className="activity-feed-header">
        <p className="panel-kicker">{ui.activityFeedTitle}</p>
      </div>

      {entries.length === 0 ? (
        <p className="activity-empty">{ui.activityFeedEmpty}</p>
      ) : (
        <ul className="activity-list">
          {entries.map((entry) => (
            <li className={`activity-entry ${entry.type}`} key={entry.id}>
              <span className="activity-category">
                {getEntryCategory(entry, ui)}
              </span>
              <p className="activity-message">
                {getEntryMessage(entry, tasks, shopNodes, topics, ui)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
