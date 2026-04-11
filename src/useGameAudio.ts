import { useCallback, useRef } from 'react'

type SoundEvent =
  | 'launch'
  | 'score'
  | 'penalty'
  | 'portal'
  | 'task_success'
  | 'task_failure'
  | 'shop'

type ToneSpec = {
  freq: number
  duration: number
  delay?: number
  gain?: number
  type?: OscillatorType
}

const SOUND_LIBRARY: Record<SoundEvent, ToneSpec[]> = {
  launch: [
    { freq: 430, duration: 0.06, gain: 0.16, type: 'triangle' },
    { freq: 620, duration: 0.04, delay: 0.035, gain: 0.1, type: 'sine' },
  ],
  score: [
    { freq: 620, duration: 0.05, gain: 0.12, type: 'triangle' },
    { freq: 930, duration: 0.08, delay: 0.045, gain: 0.14, type: 'triangle' },
  ],
  penalty: [
    { freq: 280, duration: 0.06, gain: 0.12, type: 'sawtooth' },
    { freq: 180, duration: 0.09, delay: 0.05, gain: 0.1, type: 'sine' },
  ],
  portal: [
    { freq: 540, duration: 0.04, gain: 0.08, type: 'sine' },
    { freq: 810, duration: 0.05, delay: 0.03, gain: 0.08, type: 'triangle' },
    { freq: 1080, duration: 0.08, delay: 0.065, gain: 0.06, type: 'sine' },
  ],
  task_success: [
    { freq: 660, duration: 0.05, gain: 0.12, type: 'triangle' },
    { freq: 990, duration: 0.06, delay: 0.04, gain: 0.12, type: 'triangle' },
    { freq: 1320, duration: 0.09, delay: 0.08, gain: 0.13, type: 'triangle' },
  ],
  task_failure: [
    { freq: 320, duration: 0.06, gain: 0.11, type: 'square' },
    { freq: 240, duration: 0.08, delay: 0.045, gain: 0.1, type: 'square' },
    { freq: 180, duration: 0.1, delay: 0.095, gain: 0.08, type: 'sine' },
  ],
  shop: [
    { freq: 520, duration: 0.05, gain: 0.1, type: 'triangle' },
    { freq: 780, duration: 0.07, delay: 0.04, gain: 0.11, type: 'triangle' },
    { freq: 1040, duration: 0.1, delay: 0.085, gain: 0.12, type: 'triangle' },
  ],
}

function getAudioContextCtor() {
  if (typeof window === 'undefined') {
    return null
  }

  const windowWithWebkit = window as typeof window & {
    webkitAudioContext?: typeof AudioContext
  }

  return window.AudioContext ?? windowWithWebkit.webkitAudioContext ?? null
}

function scheduleTone(
  context: AudioContext,
  destination: AudioNode,
  startAt: number,
  tone: ToneSpec,
) {
  const oscillator = context.createOscillator()
  const gainNode = context.createGain()
  const startTime = startAt + (tone.delay ?? 0)
  const peakGain = tone.gain ?? 0.12
  const endTime = startTime + tone.duration

  oscillator.type = tone.type ?? 'sine'
  oscillator.frequency.setValueAtTime(tone.freq, startTime)

  gainNode.gain.setValueAtTime(0.0001, startTime)
  gainNode.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.01)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime)

  oscillator.connect(gainNode)
  gainNode.connect(destination)

  oscillator.start(startTime)
  oscillator.stop(endTime + 0.02)
}

export function useGameAudio(enabled: boolean) {
  const contextRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)

  const ensureContext = useCallback(() => {
    if (contextRef.current !== null) {
      return contextRef.current
    }

    const AudioContextCtor = getAudioContextCtor()

    if (AudioContextCtor === null) {
      return null
    }

    const context = new AudioContextCtor()
    const masterGain = context.createGain()
    masterGain.gain.value = 0.16
    masterGain.connect(context.destination)

    contextRef.current = context
    masterGainRef.current = masterGain

    return context
  }, [])

  const unlock = useCallback(() => {
    const context = ensureContext()

    if (context === null || context.state !== 'suspended') {
      return
    }

    void context.resume()
  }, [ensureContext])

  const play = useCallback(
    (sound: SoundEvent) => {
      if (!enabled) {
        return
      }

      const context = ensureContext()
      const masterGain = masterGainRef.current

      if (context === null || masterGain === null || context.state !== 'running') {
        return
      }

      const tones = SOUND_LIBRARY[sound]
      const startAt = context.currentTime + 0.01

      tones.forEach((tone) => {
        scheduleTone(context, masterGain, startAt, tone)
      })
    },
    [enabled, ensureContext],
  )

  return {
    unlock,
    play,
  }
}
