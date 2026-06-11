import { parse, stringify } from 'yaml'

const FM_RE = /^---\r?\n(?:([\s\S]*?)\r?\n)?---(?:\r?\n|$)/

export function parseFrontmatter(text) {
  const m = text.match(FM_RE)
  if (!m) throw new Error('missing frontmatter (expected leading --- block)')
  return { data: parse(m[1] ?? '') ?? {}, body: text.slice(m[0].length) }
}

export function serializeFrontmatter(data, body = '') {
  return `---\n${stringify(data)}---\n${body}`
}
