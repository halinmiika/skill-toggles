import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { SkillEntry } from '../types'

const PANE = 'skill-toggles'
const TITLE = 'Skills'
const COMMAND = 'skills-panel'
const LOOSE = 'Claude Code & perso'

const skills = atom({ plugin: 'skill-toggles', key: 'skills' } as const, [])
const disabled = atom({ plugin: 'skill-toggles', key: 'disabled' } as const, [])
const openGroup = atom({ plugin: 'skill-toggles', key: 'openGroup' } as const, null)
const isSynced = atom({ plugin: 'skill-toggles', key: 'isSynced' } as const, false)

// One entry of the skill listing: "- name: description" or "- name (alias): description".
const ENTRY = /^- ([A-Za-z0-9_.-]+(?::[A-Za-z0-9_.-]+)?)(?: \([^)]*\))?: /

type Block = { name: string | null; lines: string[] }

function splitListing(text: string): Block[] {
  const blocks: Block[] = [{ name: null, lines: [] }]
  for (const line of text.split('\n')) {
    const name = ENTRY.exec(line)?.[1]
    if (name) blocks.push({ name, lines: [line] })
    else blocks.at(-1)?.lines.push(line)
  }

  return blocks
}

const groupOf = (name: string) => (name.includes(':') ? name.slice(0, name.indexOf(':')) : LOOSE)
const shortOf = (name: string) => name.slice(name.indexOf(':') + 1)

function isOff(name: string, off: readonly string[], known: readonly SkillEntry[]) {
  if (off.includes(name)) return true
  // "/tdd" typed for "mattpocock-skills:tdd": only when no other skill answers to that name.
  const owners = known.filter(s => s.name === name || shortOf(s.name) === name)

  return owners.length === 1 && off.includes(owners[0]?.name ?? '')
}

function groupsOf(list: readonly SkillEntry[]) {
  const groups = new Map<string, SkillEntry[]>()
  for (const s of list) groups.set(groupOf(s.name), [...(groups.get(groupOf(s.name)) ?? []), s])

  return [...groups].sort(([a], [b]) => (a === LOOSE ? 1 : b === LOOSE ? -1 : a.localeCompare(b)))
}

// The first listing of a session replaces what earlier sessions stored; later ones add to it.
async function remember($: EngineInterface, found: SkillEntry[]) {
  if (found.length === 0) return
  const isFresh = !(await read($, isSynced))
  await update($, skills, list => {
    const byName = new Map((isFresh ? [] : list).map(s => [s.name, s]))
    for (const s of found) byName.set(s.name, s)

    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
  })
  await update($, isSynced, () => true)
  await $.store.set('skills', await read($, skills))
}

async function setOff($: EngineInterface, names: readonly string[], isTurningOff: boolean) {
  await update($, disabled, list => {
    const rest = list.filter(n => !names.includes(n))

    return isTurningOff ? [...rest, ...names].sort() : rest
  })
  await $.store.set('disabled', await read($, disabled))
  // The skill listing is re-asked on the next request, without the skills now off.
  $.ui.invalidate('prompt.attachment')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const stored = await $.store.get('disabled')
    if (Array.isArray(stored)) await update($, disabled, () => stored as string[])
    if ((await read($, skills)).length === 0) {
      const known = await $.store.get('skills')
      if (Array.isArray(known)) await update($, skills, () => known as SkillEntry[])
    }
    await $.command.register({
      name: COMMAND,
      description: 'Ouvre le panneau Skills pour activer ou désactiver chaque skill',
    })
    void $.ui.open({ id: PANE, title: TITLE })

    return next(e)
  })

  on('command.run', { command: COMMAND }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Panneau Skills ouvert.' }
  })

  on('prompt.attachment', { type: 'skill_listing' }, async ($, e, next) => {
    const listed = await next(e)
    if (listed.text === null) return listed
    const blocks = splitListing(listed.text)
    await remember(
      $,
      blocks.flatMap(b =>
        b.name === null ? [] : [{ name: b.name, tokens: Math.ceil(b.lines.join('\n').length / 4) }],
      ),
    )
    const off = await read($, disabled)
    const kept = blocks.filter(b => b.name === null || !off.includes(b.name))
    if (kept.length === blocks.length) return listed
    if (kept.every(b => b.name === null)) return { text: null }

    return { text: kept.flatMap(b => b.lines).join('\n') }
  })

  on('skill.prompt', async ($, e, next) => {
    if (!isOff(e.skill, await read($, disabled), await read($, skills))) return next(e)
    $.ui.toast(`« ${e.skill} » est désactivé : réactive-le dans le panneau Skills`)

    return {
      text: `The user turned the skill "${e.skill}" off in the Skills panel, so its instructions are withheld. Do not try to follow it: tell the user it is off and that /${COMMAND} turns it back on.`,
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const list = await read($, skills)
    if (list.length === 0) {
      return (
        <Box flexDirection="column">
          <Text dimColor>Envoie un message : la liste des skills apparaîtra ici.</Text>
        </Box>
      )
    }
    const off = await read($, disabled)
    const current = await read($, openGroup)
    const offList = list.filter(s => off.includes(s.name))
    const saved = offList.reduce((sum, s) => sum + s.tokens, 0)

    return (
      <Box flexDirection="column">
        <Text dimColor>
          {list.length - offList.length}/{list.length} actifs · ~{saved} tokens retirés du contexte
        </Text>
        {groupsOf(list).map(([group, members]) => {
          const isOpen = group === current
          const names = members.map(s => s.name)
          const onCount = members.filter(s => !off.includes(s.name)).length

          return (
            <Box key={`g:${group}`} flexDirection="column" marginTop={1}>
              <Button
                key={`group:${group}`}
                label={`${isOpen ? '▾' : '▸'} ${group} (${onCount}/${members.length})`}
                onPress={() => update($, openGroup, () => (isOpen ? null : group))}
              />
              {isOpen && (
                <Box flexDirection="column" paddingLeft={2}>
                  {members.map(s => {
                    const isOn = !off.includes(s.name)

                    return (
                      <Button
                        key={`skill:${s.name}`}
                        dimColor={!isOn}
                        label={`${isOn ? '●' : '○'} ${shortOf(s.name)}`}
                        onPress={() => setOff($, [s.name], isOn)}
                      />
                    )
                  })}
                  <Box flexDirection="row" gap={1}>
                    <Button key="all-on" label="Tout activer" onPress={() => setOff($, names, false)} />
                    <Button key="all-off" label="Tout désactiver" onPress={() => setOff($, names, true)} />
                  </Box>
                </Box>
              )}
            </Box>
          )
        })}
      </Box>
    )
  })
}
