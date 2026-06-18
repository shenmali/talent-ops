// board/lib/render.mjs — pure: board model -> HTML strings. No DOM, no deps.

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  )
}

export function renderPage({ title, body, userId }) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — talent-ops</title>
<link rel="stylesheet" href="/public/style.css">
</head><body>
<header class="topbar">
  <nav><a href="/">Pipeline</a></nav>
  <span class="who">Acting as <strong>human:${esc(userId)}</strong> · AI recommends, you decide</span>
</header>
<main>${body}</main>
<script src="/public/app.js"></script>
</body></html>`
}

function slaClass(sla) {
  return sla === 'over' ? 'sla-over' : sla === 'warn' ? 'sla-warn' : 'sla-ok'
}

function card(roleSlug, c) {
  const score = c.weightedTotal == null ? '—' : `${esc(c.weightedTotal)} (${esc(c.confidence)})`
  const missing = c.missingCount == null ? '' : `<span class="missing">missing: ${esc(c.missingCount)}</span>`
  const days = c.daysInStage == null ? '' : `<span class="days ${slaClass(c.sla)}">${c.daysInStage}d</span>`
  const rec = c.recommendation ? `<span class="rec rec-${esc(c.recommendation)}">${esc(c.recommendation)}</span>` : ''
  const auth = c.authenticity && c.authenticity.count > 0
    ? `<span class="auth auth-${esc(c.authenticity.maxSeverity)}">⚑ auth · ${esc(c.authenticity.maxSeverity)}</span>` : ''
  return `<a class="card" href="/candidate/${esc(roleSlug)}/${esc(c.slug)}">
  <span class="name">${esc(c.name)}</span>
  <span class="score">${score}</span>
  ${rec}${auth}${missing}${days}
  <span class="src">${esc(c.source)}</span>
</a>`
}

export function renderPipeline(model) {
  const cols = ['parsed', 'screened', 'triage', 'interview', 'decision', 'hired', 'rejected', 'withdrawn']
  const roles = model.roles.map((role) => {
    const byStage = Object.fromEntries(cols.map((s) => [s, []]))
    for (const c of role.candidates) (byStage[c.stage] ??= []).push(c)
    const columns = cols.map((s) => `<section class="col"><h3>${s} <span class="n">${role.counts[s] ?? 0}</span></h3>
${(byStage[s] || []).map((c) => card(role.slug, c)).join('\n')}</section>`).join('\n')
    return `<section class="role">
<h2><a href="/role/${esc(role.slug)}">${esc(role.title)}</a> <span class="status">${esc(role.status)}</span>
  · <a href="/triage/${esc(role.slug)}">triage queue</a></h2>
<div class="board">${columns}</div></section>`
  }).join('\n')
  return `<h1>Pipeline</h1>${roles || '<p>No roles yet.</p>'}`
}

function evidenceTable(claims) {
  if (!claims.length) return '<p>No evidence ledger yet.</p>'
  const rows = claims.map((c, i) => `<tr>
<td>${esc(c.claim)}</td><td>${esc(c.source)}</td><td>${esc(c.evidence) || '—'}</td>
<td>${esc(c.confidence)}</td><td class="st-${esc(c.status)}">${esc(c.status)}</td></tr>`).join('\n')
  return `<table class="ledger"><thead><tr><th>claim</th><th>source</th><th>evidence</th><th>confidence</th><th>status</th></tr></thead><tbody>${rows}</tbody></table>`
}

function scoreBreakdown(score) {
  if (!score) return '<p>Not scored yet.</p>'
  const s = score.scores || {}
  const layers = Object.entries(s).map(([k, v]) => `<li>${esc(k)}: <strong>${esc(v)}</strong></li>`).join('')
  return `<ul class="layers">${layers}</ul>
<p>weighted_total: <strong>${esc(score.weighted_total)}</strong> (confidence: ${esc(score.confidence)}) ·
recommendation: <span class="rec rec-${esc(score.recommendation)}">${esc(score.recommendation)}</span> ·
<em>assistive — not a decision</em></p>`
}

function authenticityBlock(score) {
  const sigs = Array.isArray(score?.authenticity_signals) ? score.authenticity_signals : []
  if (!sigs.length) return ''
  const items = sigs.map((s) =>
    `<li class="auth-${esc(s.severity)}"><strong>${esc(s.signal)}</strong> · ${esc(s.severity)} — ${esc(s.basis)}</li>`
  ).join('')
  return `<section><h2>Authenticity signals</h2>
<ul class="auth-signals">${items}</ul>
<p class="auth-caveat">Human-check flags — not a decision, never auto-applied. Absence is the default.</p></section>`
}

function decisionForm(detail, states, token, userId) {
  const decisionOpts = Object.keys(states.decisions).map((d) => `<option value="${d}">${d}</option>`).join('')
  const reasonOpts = states.reason_codes.map((r) => `<option value="${r}">${r}</option>`).join('')
  return `<form class="act" method="post" action="/action/decision">
<input type="hidden" name="role" value="${esc(detail.role)}">
<input type="hidden" name="slug" value="${esc(detail.slug)}">
<input type="hidden" name="sinceToken" value="${esc(token)}">
<label>decision <select name="decision" required>${decisionOpts}</select></label>
<label>reason (required for hired/rejected/withdrawn) <select name="reason_code"><option value="">—</option>${reasonOpts}</select></label>
<label>detail <input type="text" name="reason_detail"></label>
<button type="submit">Record decision as human:${esc(userId)}</button>
</form>`
}

function stageForm(detail, states, token) {
  const opts = states.stages.filter((s) => !states.terminal.includes(s))
    .map((s) => `<option value="${s}">${s}</option>`).join('')
  return `<form class="act" method="post" action="/action/stage">
<input type="hidden" name="role" value="${esc(detail.role)}">
<input type="hidden" name="slug" value="${esc(detail.slug)}">
<input type="hidden" name="sinceToken" value="${esc(token)}">
<label>move to stage <select name="toStage">${opts}</select></label>
<button type="submit">Change stage</button>
<small>Terminal stages (hired/rejected/withdrawn) only via a decision.</small>
</form>`
}

function evidenceMarkForm(detail, token) {
  const rows = detail.claims.map((c, i) => `<form class="act inline" method="post" action="/action/evidence">
<input type="hidden" name="role" value="${esc(detail.role)}">
<input type="hidden" name="slug" value="${esc(detail.slug)}">
<input type="hidden" name="claimIndex" value="${i}">
<input type="hidden" name="sinceToken" value="${esc(token)}">
<span>${esc(c.claim)}</span>
<button name="status" value="human-confirmed">confirm</button>
<button name="status" value="contradicted">contradict</button>
</form>`).join('\n')
  return rows || '<p>No claims to mark.</p>'
}

function noteForm(detail, token) {
  return `<form class="act" method="post" action="/action/note">
<input type="hidden" name="role" value="${esc(detail.role)}">
<input type="hidden" name="slug" value="${esc(detail.slug)}">
<input type="hidden" name="sinceToken" value="${esc(token)}">
<label>note <input type="text" name="text" required></label>
<button type="submit">Add note</button>
</form>`
}

export function renderCandidate(detail, states, { tokens, userId }) {
  const dec = detail.decision
    ? `<div class="decided"><strong>${esc(detail.decision.decision)}</strong>
       (${esc(detail.decision.reason_code) || 'no code'}) by ${esc(detail.decision.decided_by)} on ${esc(detail.decision.decided_at)}</div>`
    : '<p>No decision recorded.</p>'
  return `<h1>${esc(detail.name)} <span class="status">${esc(detail.stage)}</span></h1>
<p><a href="/">← pipeline</a> · <a href="/role/${esc(detail.role)}">role</a></p>
<section><h2>Evidence ledger</h2>${evidenceTable(detail.claims)}</section>
<section><h2>Score</h2>${scoreBreakdown(detail.score)}</section>
${authenticityBlock(detail.score)}
<section><h2>Decision</h2>${dec}</section>
<section class="actions"><h2>Actions</h2>
${decisionForm(detail, states, tokens.decision, userId)}
${stageForm(detail, states, tokens.profileToken)}
<h3>Mark evidence</h3>${evidenceMarkForm(detail, tokens.evidence)}
<h3>Note</h3>${noteForm(detail, tokens.profileToken)}
</section>`
}

export function renderTriage(roleModel, queue, states, { userId }) {
  const banner = queue.calibrate
    ? `<div class="calibrate">Calibration: review the first entries WITH the hiring manager before bulk action.</div>`
    : ''
  const reasonOpts = states.reason_codes.map((r) => `<option value="${r}">${r}</option>`).join('')
  // Each row carries a checkbox bound (form="bulk-reject") to the bulk form below.
  const rows = queue.entries.map((c, i) => `<tr class="${c.calibrate ? 'calibrate' : ''}">
<td><input type="checkbox" name="slug" value="${esc(c.slug)}" form="bulk-reject"></td>
<td>${i + 1}</td><td><a href="/candidate/${esc(roleModel.slug)}/${esc(c.slug)}">${esc(c.name)}</a></td>
<td>${esc(c.weightedTotal)} (${esc(c.confidence)})</td>
<td>${esc(c.recommendation)}</td><td>missing: ${esc(c.missingCount)}</td></tr>`).join('\n')
  const blocked = queue.needsHumanLook.map((c) => `<li><a href="/candidate/${esc(roleModel.slug)}/${esc(c.slug)}">${esc(c.name)}</a> — ${esc(c.recommendation)} (hard filter / disqualifier)</li>`).join('\n')
  // Bulk decision: reject only (advancing is deliberate, done one-by-one on the candidate page).
  const bulkForm = `<form id="bulk-reject" class="act" method="post" action="/action/triage-reject">
<input type="hidden" name="role" value="${esc(roleModel.slug)}">
<label>reason for selected <select name="reason_code" required><option value="">—</option>${reasonOpts}</select></label>
<label class="confirm"><input type="checkbox" name="antiMissConfirmed" value="yes" required> anti-miss: I re-checked the selected candidates above before rejecting</label>
<button type="submit">Reject selected</button>
</form>`
  return `<h1>Triage — ${esc(roleModel.title)}</h1>
<p><a href="/">← pipeline</a></p>
${banner}
<table class="queue"><thead><tr><th></th><th>#</th><th>candidate</th><th>score</th><th>recommendation</th><th>gaps</th></tr></thead>
<tbody>${rows || '<tr><td colspan="6">No screened candidates.</td></tr>'}</tbody></table>
<p class="anti-miss"><strong>anti-miss:</strong> before rejecting in bulk, re-check a sample spread across the score range — the confirm box below is required.</p>
${bulkForm}
<section class="needs-human"><h2>Requires explicit human look (never auto-decided)</h2>
<ul>${blocked || '<li>none</li>'}</ul></section>
<p>Advancing and per-candidate decisions are recorded from each candidate's page, stamped human:${esc(userId)}.</p>`
}

export function renderRole(roleModel, contractBody) {
  const driftIdx = contractBody.indexOf('## Criteria drift log')
  const drift = driftIdx >= 0 ? contractBody.slice(driftIdx) : '(no drift log)'
  const jd = roleModel.jdExists
    ? `<a href="/role/${esc(roleModel.slug)}/jd">view JD</a> · disclosure: ${roleModel.hasDisclosure ? 'present' : 'MISSING'}`
    : 'no JD generated'
  return `<h1>${esc(roleModel.title)} <span class="status">${esc(roleModel.status)}</span></h1>
<p><a href="/">← pipeline</a> · <a href="/triage/${esc(roleModel.slug)}">triage queue</a></p>
<p>approved_by: ${esc(roleModel.approvedBy) || '—'} · ${jd}</p>
<section><h2>Criteria drift log</h2><pre>${esc(drift)}</pre></section>`
}
