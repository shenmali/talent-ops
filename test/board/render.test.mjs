import { describe, it, expect } from 'vitest'
import { renderPage, renderPipeline, renderCandidate, renderTriage, renderRole } from '../../board/lib/render.mjs'
import { buildModel, loadCandidate, triageQueue } from '../../board/lib/model.mjs'
import { loadStates } from '../../scripts/lib/states.mjs'
import { makeRepo, approvedContract } from '../helpers.mjs'

function repo() {
  return makeRepo({
    'roles/demo-role/role-contract.md': approvedContract,
    'roles/demo-role/jd.md': '---\nrole: demo-role\n---\n# JD\n<!-- ai-disclosure -->x<!-- /ai-disclosure -->\n',
    'roles/demo-role/candidates/jane-doe/profile.md':
      '---\nname: Jane Doe\nsource: "inbound:jane.txt"\napplied_at: 2026-06-01\n---\nCV body\n',
    'roles/demo-role/candidates/jane-doe/evidence.md':
      '---\nclaims:\n  - claim: Python\n    source: cv\n    evidence: "repo X"\n    evidence_type: repo\n    confidence: high\n    status: ai-inferred\n    note: ""\n---\n',
    'roles/demo-role/candidates/jane-doe/score.md':
      '---\nweighted_total: 4.3\nconfidence: high\nrecommendation: advance\nmissing_evidence: []\nrisks: []\nscored_at: 2026-06-02\nscores:\n  skill_match: 5\n  experience_match: 4\n  evidence_match: 4\n  behavior_signals: 3\n---\nrationale\n',
  })
}

describe('renderPage', () => {
  it('wraps body in an HTML doc that links style.css and app.js and shows the user', () => {
    const html = renderPage({ title: 'Pipeline', body: '<p>hi</p>', userId: 'ali' })
    expect(html).toMatch(/<!doctype html>/i)
    expect(html).toContain('/public/style.css')
    expect(html).toContain('/public/app.js')
    expect(html).toContain('human:ali')
    expect(html).toContain('<p>hi</p>')
  })
})

describe('renderPipeline', () => {
  it('renders a card per candidate with score, confidence, recommendation, missing count, source, SLA', () => {
    const model = buildModel(repo(), { now: new Date('2026-06-11') })
    const html = renderPipeline(model)
    expect(html).toContain('Jane Doe')
    expect(html).toContain('4.3')
    expect(html).toContain('high')
    expect(html).toContain('advance')
    expect(html).toContain('inbound:jane.txt')
    expect(html).toMatch(/sla-over/) // 9 days screened → over
    expect(html).toContain('href="/candidate/demo-role/jane-doe"')
  })
})

describe('renderCandidate', () => {
  it('shows the evidence ledger, score breakdown, and write forms with sinceToken hidden inputs', () => {
    const root = repo()
    const detail = loadCandidate(root, 'demo-role', 'jane-doe')
    const states = loadStates(root)
    const tokens = { decision: 'absent', score: 'abc', profileToken: 'def' }
    const html = renderCandidate(detail, states, { tokens, userId: 'ali' })
    expect(html).toContain('Python')          // evidence claim
    expect(html).toContain('ai-inferred')      // claim status
    expect(html).toContain('skill_match')      // score breakdown
    expect(html).toContain('action/decision')  // decision form
    expect(html).toContain('name="reason_code"')
    expect(html).toContain('value="absent"')   // decision sinceToken
    // every reason code from states is an option
    for (const rc of states.reason_codes) expect(html).toContain(rc)
  })
})

describe('renderTriage', () => {
  it('renders the calibrated queue, a reason-code select, and isolates hard-fail candidates', () => {
    const root = makeRepo({
      'roles/r/role-contract.md': approvedContract,
      'roles/r/candidates/good/profile.md': '---\nname: Good\n---\nb\n',
      'roles/r/candidates/good/evidence.md': '---\nclaims: []\n---\n',
      'roles/r/candidates/good/score.md': '---\nweighted_total: 4.0\nconfidence: high\nrecommendation: advance\nmissing_evidence: []\nscores:\n  hard_filters: pass\n---\n',
      'roles/r/candidates/blocked/profile.md': '---\nname: Blocked\n---\nb\n',
      'roles/r/candidates/blocked/evidence.md': '---\nclaims: []\n---\n',
      'roles/r/candidates/blocked/score.md': '---\nweighted_total: 4.5\nconfidence: high\nrecommendation: reject-suggest\nmissing_evidence: []\nscores:\n  hard_filters: fail(work_permit)\n---\n',
    })
    const model = buildModel(root)
    const states = loadStates(root)
    const q = triageQueue(model.roles[0], states)
    const html = renderTriage(model.roles[0], q, states, { userId: 'ali' })
    expect(html).toContain('Good')
    expect(html).toContain('calibrate')             // calibration banner/flag
    expect(html).toMatch(/requires explicit human look/i)
    expect(html).toContain('Blocked')               // hard-fail isolated, still shown
    expect(html).toContain('anti-miss')             // anti-miss note
    expect(html).toContain('id="bulk-reject"')      // bulk reject form
    expect(html).toContain('antiMissConfirmed')     // required confirm box
    expect(html).toMatch(/name="slug" value="good"[^>]*form="bulk-reject"/) // row checkbox bound to bulk form
  })
})

describe('renderRole', () => {
  it('shows contract summary, drift log, and a JD link', () => {
    const root = repo()
    const model = buildModel(root)
    const html = renderRole(model.roles[0], '## Criteria drift log\n| date | changed_by | change | re-approved_by |\n')
    expect(html).toContain('Demo Role')
    expect(html).toContain('approved')
    expect(html).toContain('drift log')
    expect(html).toContain('href="/role/demo-role/jd"')
  })
})

describe('authenticity signals', () => {
  function flaggedRepo() {
    return makeRepo({
      'roles/r/role-contract.md': approvedContract,
      'roles/r/candidates/flagged/profile.md': '---\nname: Flagged\nsource: "inbound:f.txt"\napplied_at: 2026-06-05\n---\nCV\n',
      'roles/r/candidates/flagged/evidence.md': '---\nclaims: []\n---\n',
      'roles/r/candidates/flagged/score.md':
        '---\nweighted_total: 2.0\nconfidence: low\nrecommendation: hold\nmissing_evidence: []\nrisks: ["authenticity: 1 signal (1 high)"]\nscored_at: 2026-06-06\nscores:\n  skill_match: 2\nauthenticity_signals:\n  - signal: evidence-absence\n    severity: high\n    basis: "most must-haves unbacked"\n---\nr\n',
    })
  }

  it('renders a severity-colored authenticity badge on the pipeline card', () => {
    const html = renderPipeline(buildModel(flaggedRepo(), { now: new Date('2026-06-11') }))
    expect(html).toMatch(/auth-high/)
  })

  it('renders an authenticity block with signal, severity, basis, and a caveat on the candidate page', () => {
    const root = flaggedRepo()
    const detail = loadCandidate(root, 'r', 'flagged')
    const states = loadStates(root)
    const html = renderCandidate(detail, states, { tokens: { decision: 'a', evidence: 'b', profileToken: 'c' }, userId: 'ali' })
    expect(html).toContain('Authenticity signals')
    expect(html).toContain('evidence-absence')
    expect(html).toContain('most must-haves unbacked')
    expect(html).toMatch(/auth-high/)
    expect(html).toMatch(/not a decision/i)
  })

  it('omits the authenticity block when a candidate has no signals', () => {
    const root = makeRepo({
      'roles/r/role-contract.md': approvedContract,
      'roles/r/candidates/clean/profile.md': '---\nname: Clean\napplied_at: 2026-06-05\n---\nCV\n',
      'roles/r/candidates/clean/evidence.md': '---\nclaims: []\n---\n',
      'roles/r/candidates/clean/score.md': '---\nweighted_total: 4.3\nconfidence: high\nrecommendation: advance\nmissing_evidence: []\nrisks: []\nscored_at: 2026-06-06\nscores:\n  skill_match: 5\n---\nr\n',
    })
    const detail = loadCandidate(root, 'r', 'clean')
    const states = loadStates(root)
    const html = renderCandidate(detail, states, { tokens: { decision: 'a', evidence: 'b', profileToken: 'c' }, userId: 'ali' })
    expect(html).not.toContain('Authenticity signals')
  })
})
