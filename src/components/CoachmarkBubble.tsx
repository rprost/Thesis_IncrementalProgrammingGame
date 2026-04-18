import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react'

type CoachmarkPlacement = 'below-end' | 'above-end'

type CoachmarkBubbleProps = {
  targetRef: RefObject<HTMLElement | null>
  message: string
  dismissLabel: string
  onDismiss: () => void
  placement?: CoachmarkPlacement
}

const HORIZONTAL_MARGIN = 12
const VERTICAL_GAP = 14
const MAX_BUBBLE_WIDTH = 320

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function CoachmarkBubble({
  targetRef,
  message,
  dismissLabel,
  onDismiss,
  placement = 'below-end',
}: CoachmarkBubbleProps) {
  const [style, setStyle] = useState<CSSProperties | null>(null)
  const [resolvedPlacement, setResolvedPlacement] =
    useState<CoachmarkPlacement>(placement)

  useLayoutEffect(() => {
    let rafId: number | null = null

    const updatePosition = () => {
      const target = targetRef.current

      if (target === null) {
        setStyle(null)
        return
      }

      const rect = target.getBoundingClientRect()
      const bubbleWidth = Math.min(
        MAX_BUBBLE_WIDTH,
        window.innerWidth - HORIZONTAL_MARGIN * 2,
      )
      const maxLeft = Math.max(
        HORIZONTAL_MARGIN,
        window.innerWidth - bubbleWidth - HORIZONTAL_MARGIN,
      )
      const left = clamp(rect.right - bubbleWidth, HORIZONTAL_MARGIN, maxLeft)
      const shouldFlipBelow =
        placement === 'above-end' && rect.top < 220
      const nextPlacement =
        shouldFlipBelow ? 'below-end' : placement
      const top =
        nextPlacement === 'below-end'
          ? rect.bottom + VERTICAL_GAP
          : rect.top - VERTICAL_GAP

      setResolvedPlacement(nextPlacement)
      setStyle({
        width: `${bubbleWidth}px`,
        left: `${left}px`,
        top: `${top}px`,
      })
    }

    const scheduleUpdate = () => {
      if (rafId !== null) {
        return
      }

      rafId = window.requestAnimationFrame(() => {
        rafId = null
        updatePosition()
      })
    }

    updatePosition()
    window.addEventListener('resize', scheduleUpdate)
    window.addEventListener('scroll', scheduleUpdate, {
      capture: true,
      passive: true,
    })

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
      }

      window.removeEventListener('resize', scheduleUpdate)
      window.removeEventListener('scroll', scheduleUpdate, true)
    }
  }, [placement, targetRef])

  if (style === null) {
    return null
  }

  return (
    <div
      className={`coachmark-bubble placement-${resolvedPlacement}`}
      role="dialog"
      aria-modal="false"
      style={style}
    >
      <p>{message}</p>
      <button
        className="secondary-button coachmark-dismiss"
        onClick={onDismiss}
        type="button"
      >
        {dismissLabel}
      </button>
    </div>
  )
}
