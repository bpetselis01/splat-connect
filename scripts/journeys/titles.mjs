// Reads journey ids from test case titles. Never executes a test.
import ts from 'typescript'

const ID = /^W?[A-Z]\d{2}$/
const RUNNERS = new Set(['test', 'it'])

// Leading `@tag` tokens may precede the ids (Playwright); ids end at the first non-id token.
function leadingIds(title, errors) {
  const ids = []
  const tokens = title.split(/\s+/).filter(Boolean)
  while (tokens[0]?.startsWith('@')) tokens.shift()
  for (const token of tokens) {
    if (!ID.test(token)) break
    if (ids.includes(token)) errors.push(`duplicate id ${token} in title "${title}"`)
    else ids.push(token)
  }
  return ids
}

const isRunner = (n) => ts.isIdentifier(n) && RUNNERS.has(n.text)
const isEach = (n) => ts.isPropertyAccessExpression(n) && n.name.text === 'each' && isRunner(n.expression)
const isOnly = (n) => ts.isPropertyAccessExpression(n) && n.name.text === 'only' && isRunner(n.expression)

function isCase(call) {
  const callee = call.expression
  if (isRunner(callee) || isOnly(callee)) return true
  if (ts.isCallExpression(callee)) return isEach(callee.expression)
  if (ts.isTaggedTemplateExpression(callee)) return isEach(callee.tag)
  return false
}

function parseTs(source) {
  const file = ts.createSourceFile('t.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const ids = []
  const errors = []
  const visit = (node) => {
    const title = ts.isCallExpression(node) && isCase(node) ? node.arguments[0] : undefined
    if (title && (ts.isStringLiteral(title) || ts.isNoSubstitutionTemplateLiteral(title))) ids.push(...leadingIds(title.text, errors))
    else if (title && ts.isTemplateExpression(title)) {
      const head = title.head.text.trim().split(/\s+/).filter((t) => !t.startsWith('@'))[0]
      if (!head || ID.test(head)) errors.push(`dynamic id in title "${title.getText(file)}"`)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return { ids, errors }
}

// A Maestro flow's config block sits above the first `---`; only a column-0 `name:` there counts.
export function yamlName(source) {
  for (const line of source.split('\n')) {
    if (/^---\s*$/.test(line)) return undefined
    const m = line.match(/^name:\s*(.*?)\s*$/)
    if (m) return m[1].replace(/^(["'])(.*)\1$/, '$2')
  }
  return undefined
}

export function parseTitles(source, kind) {
  if (kind === 'ts') return parseTs(source)
  const errors = []
  return { ids: leadingIds(yamlName(source) ?? '', errors), errors }
}
