import type { UiText } from '../types'
import { useDialogFocusTrap } from '../useAccessibility'

type IntroModalProps = {
  ui: UiText
  isOpen: boolean
  onStart: () => void
}

export function IntroModal({ ui, isOpen, onStart }: IntroModalProps) {
  const dialogRef = useDialogFocusTrap<HTMLElement>(isOpen, null)

  if (!isOpen) {
    return null
  }

  return (
    <div className="modal-backdrop intro-backdrop" role="presentation">
      <section
        className="modal-card intro-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="intro-title"
        tabIndex={-1}
      >
        <div>
          <p className="modal-kicker">{ui.introEyebrow}</p>
          <h2 id="intro-title">{ui.introTitle}</h2>
        </div>

        <p className="intro-body">{ui.introBody}</p>

        <div className="intro-warning">
          <span>{ui.introZoomWarningLabel}</span>
          <p>{ui.introZoomWarning}</p>
        </div>

        <div className="intro-checklist">
          <span>{ui.introChecklistLabel}</span>
          <ul>
            <li>{ui.introChecklistOne}</li>
            <li>{ui.introChecklistTwo}</li>
            <li>{ui.introChecklistThree}</li>
          </ul>
        </div>

        <div className="intro-reminder">
          <span>{ui.introFeedbackReminderLabel}</span>
          <p>{ui.introFeedbackReminder}</p>
        </div>

        <button
          className="secondary-button intro-start-button"
          data-autofocus="true"
          onClick={onStart}
          type="button"
        >
          {ui.introStartButton}
        </button>
      </section>
    </div>
  )
}
