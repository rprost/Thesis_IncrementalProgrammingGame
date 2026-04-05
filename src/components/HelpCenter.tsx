import type { UiText } from '../types'

export type HelpEntry = {
  id: string
  title: string
  body: string
  snippet?: string
}

type HelpCenterProps = {
  ui: UiText
  entries: HelpEntry[]
  activeEntryId: string | null
  isOpen: boolean
  hasUnread: boolean
  onToggle: () => void
  onClose: () => void
  onSelect: (entryId: string) => void
}

export function HelpCenter({
  ui,
  entries,
  activeEntryId,
  isOpen,
  hasUnread,
  onToggle,
  onClose,
  onSelect,
}: HelpCenterProps) {
  const activeEntry =
    entries.find((entry) => entry.id === activeEntryId) ?? entries[entries.length - 1] ?? null

  return (
    <>
      <button
        className={`help-fab${hasUnread ? ' unread' : ''}`}
        aria-expanded={isOpen}
        aria-label={ui.helpCenterButtonLabel}
        onClick={onToggle}
        type="button"
      >
        ?
      </button>

      {isOpen ? (
        <div className="help-center-backdrop" role="presentation">
          <section className="help-center" aria-label={ui.helpCenterTitle}>
            <div className="help-center-header">
              <div>
                <p className="panel-kicker">{ui.helpCenterTitle}</p>
                <h2 className="help-center-title">
                  {activeEntry?.title ?? ui.helpCenterEmpty}
                </h2>
              </div>
              <button className="ghost-button" onClick={onClose} type="button">
                {ui.helpCenterCloseButton}
              </button>
            </div>

            <div className="help-center-layout">
              <aside className="help-center-sidebar">
                <p className="help-center-sidebar-label">{ui.helpCenterArchiveLabel}</p>
                {entries.length === 0 ? (
                  <p className="help-center-empty">{ui.helpCenterEmpty}</p>
                ) : (
                  <div className="help-entry-list">
                    {entries
                      .slice()
                      .reverse()
                      .map((entry, index) => (
                        <button
                          className={`help-entry-button${
                            entry.id === activeEntry?.id ? ' active' : ''
                          }`}
                          key={entry.id}
                          onClick={() => onSelect(entry.id)}
                          type="button"
                        >
                          <span>
                            {index === 0
                              ? ui.helpCenterLatestLabel
                              : `${ui.helpCenterArchiveItemLabel} ${entries.length - index}`}
                          </span>
                          <strong>{entry.title}</strong>
                        </button>
                      ))}
                  </div>
                )}
              </aside>

              <div className="help-center-body">
                {activeEntry !== null ? (
                  <>
                    <p>{activeEntry.body}</p>
                    {activeEntry.snippet !== undefined ? (
                      <pre className="help-center-snippet">
                        <code>{activeEntry.snippet}</code>
                      </pre>
                    ) : null}
                  </>
                ) : (
                  <p className="help-center-empty">{ui.helpCenterEmpty}</p>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
