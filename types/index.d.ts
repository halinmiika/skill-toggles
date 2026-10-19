export type SkillEntry = { name: string; tokens: number }

declare module 'claude-code' {
  interface PluginState {
    'skill-toggles': {
      skills: SkillEntry[]
      disabled: string[]
      openGroup: string | null
      isSynced: boolean
    }
  }
}
