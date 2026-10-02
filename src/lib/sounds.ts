/**
 * Lightweight sound effects using Web Audio API.
 * No external audio files needed — generates short tones programmatically.
 */

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  // Resume if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

/**
 * Short rising "pop" — played when user sends a message.
 * Reminiscent of iMessage / WhatsApp send.
 */
export function playSendSound() {
  try {
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(600, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.08)

    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.12)
  } catch {
    // Silently fail if audio is unavailable
  }
}

/**
 * Soft chime — played when AI's first token arrives.
 * Two-note descending tone, gentle and warm.
 */
export function playReceiveSound() {
  try {
    const ctx = getCtx()

    // First note
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(880, ctx.currentTime)
    gain1.gain.setValueAtTime(0.08, ctx.currentTime)
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(ctx.currentTime)
    osc1.stop(ctx.currentTime + 0.15)

    // Second note (slightly lower, delayed)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(660, ctx.currentTime + 0.08)
    gain2.gain.setValueAtTime(0, ctx.currentTime)
    gain2.gain.setValueAtTime(0.06, ctx.currentTime + 0.08)
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(ctx.currentTime + 0.08)
    osc2.stop(ctx.currentTime + 0.25)
  } catch {
    // Silently fail if audio is unavailable
  }
}

/** Subtle vibration for mobile haptic feedback */
export function hapticTap(ms = 40) {
  try {
    navigator?.vibrate?.(ms)
  } catch {
    // Silently fail — not all browsers support vibrate
  }
}
