type TutorialSpotlightProps = {
  label: string
  title: string
  message: string
  dismissLabel: string
  onDismiss: () => void
}

export function TutorialSpotlight({
  label,
  title,
  message,
  dismissLabel,
  onDismiss,
}: TutorialSpotlightProps) {
  return (
    <div className="tutorial-spotlight" role="note" aria-live="polite">
      <p className="tutorial-label">{label}</p>
      <strong className="tutorial-title">{title}</strong>
      <p className="tutorial-message">{message}</p>
      <button
        className="tutorial-dismiss-button"
        type="button"
        onClick={onDismiss}
      >
        {dismissLabel}
      </button>
    </div>
  )
}
