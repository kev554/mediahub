export type AuroraSettings = {
  enabled: boolean
  intensity: number
}

const AURORA_SETTINGS_KEY = 'mediahub_aurora_settings'
const DEFAULT_AURORA_SETTINGS: AuroraSettings = {
  enabled: true,
  intensity: 48,
}

export function getAuroraSettings(): AuroraSettings {
  try {
    const saved = localStorage.getItem(AURORA_SETTINGS_KEY)
    if (!saved) return DEFAULT_AURORA_SETTINGS

    const parsed: unknown = JSON.parse(saved)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'enabled' in parsed &&
      typeof parsed.enabled === 'boolean' &&
      'intensity' in parsed &&
      typeof parsed.intensity === 'number' &&
      Number.isFinite(parsed.intensity)
    ) {
      return {
        enabled: parsed.enabled,
        intensity: Math.max(0, Math.min(100, parsed.intensity)),
      }
    }
    console.warn('Saved aurora settings are invalid; using defaults.')
  } catch (error) {
    console.warn('Could not read saved aurora settings; using defaults.', error)
  }
  return DEFAULT_AURORA_SETTINGS
}

export function applyAuroraSettings(settings: AuroraSettings): void {
  const root = document.documentElement
  root.dataset.aurora = settings.enabled && settings.intensity > 0 ? 'on' : 'off'
  root.style.setProperty('--aurora-opacity', String(settings.intensity / 100 * 0.3))
}

export function saveAuroraSettings(settings: AuroraSettings): void {
  localStorage.setItem(AURORA_SETTINGS_KEY, JSON.stringify(settings))
  applyAuroraSettings(settings)
}
