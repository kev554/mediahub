let favoriteAudioContext: AudioContext | null = null

export function celebrateFavoriteAdded() {
  window.dispatchEvent(new Event('mediahub:favorite-added'))
}

export function prepareFavoriteSound() {
  if (typeof window.AudioContext === 'undefined') {
    return () => {}
  }

  try {
    favoriteAudioContext ??= new window.AudioContext()
    const context = favoriteAudioContext
    const ready = context.state === 'running'
      ? Promise.resolve()
      : context.resume()

    return () => {
      void ready.then(() => {
        if (context.state !== 'running') return

        const notes = [392, 493.88, 587.33]
        const startedAt = context.currentTime + 0.015

        notes.forEach((frequency, index) => {
          const start = startedAt + index * 0.16
          const noteDuration = 0.58 - index * 0.04

          ;[
            { ratio: 1, level: 0.012 },
            { ratio: 2, level: 0.0015 },
          ].forEach(({ ratio, level }) => {
            const oscillator = context.createOscillator()
            const gain = context.createGain()

            oscillator.type = 'sine'
            oscillator.frequency.setValueAtTime(frequency * ratio, start)
            gain.gain.setValueAtTime(0.0001, start)
            gain.gain.exponentialRampToValueAtTime(level, start + 0.035)
            gain.gain.exponentialRampToValueAtTime(0.0001, start + noteDuration)
            oscillator.connect(gain)
            gain.connect(context.destination)
            oscillator.start(start)
            oscillator.stop(start + noteDuration + 0.02)
          })
        })
      }).catch((error: unknown) => {
        console.warn('Favorite sound could not be played.', error)
      })
    }
  } catch (error) {
    console.warn('Favorite sound could not be initialized.', error)
    return () => {}
  }
}
