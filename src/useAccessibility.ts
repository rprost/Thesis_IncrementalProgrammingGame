import { useEffect, useRef, useState } from 'react'

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true',
  )
}

export function useDialogFocusTrap<T extends HTMLElement>(
  isOpen: boolean,
  onEscape?: (() => void) | null,
) {
  const containerRef = useRef<T | null>(null)

  useEffect(() => {
    if (!isOpen || containerRef.current === null) {
      return
    }

    const container = containerRef.current
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusables = getFocusableElements(container)
    const initialFocus =
      container.querySelector<HTMLElement>('[data-autofocus="true"]') ??
      focusables[0] ??
      container

    initialFocus.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onEscape !== undefined && onEscape !== null) {
        event.preventDefault()
        onEscape()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const currentFocusables = getFocusableElements(container)

      if (currentFocusables.length === 0) {
        event.preventDefault()
        container.focus()
        return
      }

      const first = currentFocusables[0]
      const last = currentFocusables[currentFocusables.length - 1]

      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === container)
      ) {
        event.preventDefault()
        last?.focus()
        return
      }

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }

    container.addEventListener('keydown', handleKeyDown)

    return () => {
      container.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [isOpen, onEscape])

  return containerRef
}

export function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => {
      setPrefersReducedMotion(mediaQuery.matches)
    }

    updatePreference()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updatePreference)

      return () => {
        mediaQuery.removeEventListener('change', updatePreference)
      }
    }

    mediaQuery.addListener(updatePreference)

    return () => {
      mediaQuery.removeListener(updatePreference)
    }
  }, [])

  return prefersReducedMotion
}
