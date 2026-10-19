import { expect, mock, test } from 'claude-code/testing'

const LISTING = [
  'The following skills are available for use with the Skill tool:',
  '',
  '- session-start-hook (startup-hook-skill): Creating startup hooks.',
  '- mattpocock-skills:tdd: Test-driven development.',
  '- mattpocock-skills:grilling: Grill the user about a plan.',
  '  Second line of the grilling description.',
  '- anthropic-skills:docs: docs (editable docs people share).',
].join('\n')

const ENGINE = { kind: 'engine' } as const

const PANE = {
  plugin: 'skill-toggles',
  component: 'Pane',
  requestId: 'skill-toggles',
  props: {
    title: 'Skills',
    isFocused: true,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

test('a skill turned off leaves the listing and its prompt is withheld', async ($, on) => {
  mock.store(on)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('prompt.attachment', () => ({ text: LISTING }))
  on('skill.prompt', (_$, e) => ({ text: e.text }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const first = await $.prompt.attachment({ type: 'skill_listing', text: LISTING, origin: ENGINE })
  expect(first.text).toBe(LISTING)

  for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ key: 'group:mattpocock-skills' }))?.text).toContain('(2/2)')
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'group:mattpocock-skills' })
  await ui.press({ key: 'skill:mattpocock-skills:grilling' })
  expect((await ui.find({ key: 'group:mattpocock-skills' }))?.text).toContain('(1/2)')
  await ui.unmount()

  const second = await $.prompt.attachment({ type: 'skill_listing', text: LISTING, origin: ENGINE })
  expect(second.text).not.toContain('grilling')
  expect(second.text).toContain('mattpocock-skills:tdd')
  expect(second.text).toContain('session-start-hook')

  const withheld = await $.skill.prompt({ skill: 'mattpocock-skills:grilling', text: 'Grill hard.' })
  expect(withheld.text).toContain('turned the skill')
  const typedShort = await $.skill.prompt({ skill: 'grilling', text: 'Grill hard.' })
  expect(typedShort.text).toContain('turned the skill')
  const kept = await $.skill.prompt({ skill: 'mattpocock-skills:tdd', text: 'Red, green.' })
  expect(kept.text).toBe('Red, green.')
})
