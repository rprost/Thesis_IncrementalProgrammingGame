import type { RefObject } from 'react'
import type { UiText, UnlockPrimerCard } from '../types'
import { useDialogFocusTrap } from '../useAccessibility'

export type HelpEntry = {
  id: string
  title: string
  body: string
  stageLabel?: string | null
  primerCards?: UnlockPrimerCard[]
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
  buttonRef?: RefObject<HTMLButtonElement | null>
  isHighlighted?: boolean
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
  buttonRef,
  isHighlighted = false,
}: HelpCenterProps) {
  const dialogRef = useDialogFocusTrap<HTMLElement>(isOpen, onClose)
  const activeEntry =
    entries.find((entry) => entry.id === activeEntryId) ?? entries[entries.length - 1] ?? null

  return (
    <>
      <button
        className={`help-fab${hasUnread ? ' unread' : ''}${isOpen ? ' active' : ''}${
          isHighlighted ? ' coachmark-target' : ''
        }`}
        aria-expanded={isOpen}
        aria-label={ui.helpCenterButtonLabel}
        onClick={onToggle}
        ref={buttonRef}
        type="button"
      >
        <span className="help-fab-label">{ui.helpCenterTitle}</span>
      </button>

      {isOpen ? (
        <div
          className="help-center-backdrop open"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              onClose()
            }
          }}
          role="presentation"
        >
          <section
            className="help-center open"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={
              activeEntry !== null
                ? 'help-center-title help-entry-title'
                : 'help-center-title'
            }
            tabIndex={-1}
          >
            <div className="help-center-header">
              <div>
                <p className="panel-kicker">{ui.helpCenterTitle}</p>
                <h2 className="help-center-title" id="help-center-title">
                  {ui.helpCenterTitle}
                </h2>
              </div>
              <button
                className="ghost-button"
                data-autofocus="true"
                onClick={onClose}
                type="button"
              >
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
                  <div className="help-entry-panel">
                    <div className="objective-meta">
                      <p className="panel-kicker">{ui.nextStepLabel}</p>
                      {activeEntry.stageLabel ? (
                        <span className="objective-stage">{activeEntry.stageLabel}</span>
                      ) : null}
                    </div>

                    <h3 className="help-entry-title" id="help-entry-title">
                      {activeEntry.title}
                    </h3>
                    <p className="help-entry-copy">{activeEntry.body}</p>

                    {(activeEntry.primerCards?.length ?? 0) > 0 ? (
                      <article className="objective-detail-card help-entry-primer-shell">
                        <span>{ui.nextStepPrimerLabel}</span>
                        <div className="objective-primer-grid">
                          {activeEntry.primerCards?.map((card) => (
                            <section className="objective-primer-card" key={card.id}>
                              <strong>{card.title}</strong>
                              <p>{card.body}</p>
                              <div className="objective-primer-syntax">
                                <span>{ui.nextStepPrimerSyntaxLabel}</span>
                                <code>{card.syntax}</code>
                              </div>
                            </section>
                          ))}
                        </div>
                      </article>
                    ) : null}
                  </div>
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
