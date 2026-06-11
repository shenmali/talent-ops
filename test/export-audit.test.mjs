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
})
