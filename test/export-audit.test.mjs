import { describe, it, expect } from 'vitest'
import { buildAudit } from '../scripts/export-audit.mjs'
import { makeRepo, approvedContract, candidateFiles } from './helpers.mjs'

function auditRepo() {
  const a = candidateFiles('demo-role', 'jane-doe')           // rejected, no override
  const b = candidateFiles('demo-role', 'ali-veli')
  b['roles/demo-role/candidates/ali-veli/score.md'] =
    '---\nweighted_total: 2.1\nconfidence: low\nrecommendation: reject-suggest\n---\n'
  b['roles/demo-role/candidates/ali-veli/decision.md'] =
    '---\ndecision: advanced\nreason_code: ""\ndecided_by: human:tester\nai_recommendation: reject-suggest\noverride: true\n---\n'
  return makeRepo({ 'roles/demo-role/role-contract.md': approvedContract, ...a, ...b })
}

describe('buildAudit', () => {
  it('includes contract weights, every candidate row, and the override rate', () => {
    const md = buildAudit(auditRepo(), 'demo-role')
    expect(md).toMatch(/skill_match: 0.3/)
    expect(md).toMatch(/jane-doe/)
    expect(md).toMatch(/ali-veli/)
    expect(md).toMatch(/Override rate: 50%/)
  })

  it('reports a missing disclosure block in the JD', () => {
    const md = buildAudit(auditRepo(), 'demo-role')
    expect(md).toMatch(/AI disclosure in JD: MISSING/)
  })

  it('counts string "true" overrides (LLM-written YAML)', () => {
    const a = candidateFiles('demo-role', 'jane-doe')
    a['roles/demo-role/candidates/jane-doe/decision.md'] =
      '---\ndecision: advanced\nreason_code: ""\ndecided_by: human:tester\nai_recommendation: reject-suggest\noverride: "true"\n---\n'
    const root = makeRepo({ 'roles/demo-role/role-contract.md': approvedContract, ...a })
    expect(buildAudit(root, 'demo-role')).toMatch(/Override rate: 100%/)
  })

  it('reports unreadable candidate files as warnings instead of crashing', () => {
    const a = candidateFiles('demo-role', 'jane-doe')
    a['roles/demo-role/candidates/jane-doe/score.md'] = 'not frontmatter\n'
    const root = makeRepo({ 'roles/demo-role/role-contract.md': approvedContract, ...a })
    const md = buildAudit(root, 'demo-role')
    expect(md).toMatch(/## Warnings/)
    expect(md).toMatch(/unreadable frontmatter: .*score\.md/)
  })

  it('reports a present disclosure block and throws cleanly on missing role', () => {
    const a = candidateFiles('demo-role', 'jane-doe')
    const root = makeRepo({
      'roles/demo-role/role-contract.md': approvedContract,
      'roles/demo-role/jd.md': '---\nrole: demo-role\n---\nbody\n<!-- ai-disclosure -->x<!-- /ai-disclosure -->\n',
      ...a,
    })
    expect(buildAudit(root, 'demo-role')).toMatch(/AI disclosure in JD: present/)
    expect(() => buildAudit(root, 'ghost-role')).toThrow(/role not found/)
  })
})
