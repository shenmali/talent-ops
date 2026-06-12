import { describe, it, expect, afterEach } from 'vitest'
import { createBoardServer } from '../../board/server.mjs'
import { makeRepo, approvedContract } from '../helpers.mjs'

let server
afterEach(() => server?.close())

describe('board static assets', () => {
  it('serves app.js and style.css with correct mime types', async () => {
    server = createBoardServer({ root: makeRepo({ 'roles/r/role-contract.md': approvedContract }), userId: 'ali' })
    await new Promise((r) => server.listen(0, r))
    const base = `http://localhost:${server.address().port}`

    const js = await fetch(`${base}/public/app.js`)
    expect(js.status).toBe(200)
    expect(js.headers.get('content-type')).toMatch(/javascript/)
    expect(await js.text()).toContain('EventSource')

    const css = await fetch(`${base}/public/style.css`)
    expect(css.status).toBe(200)
    expect(css.headers.get('content-type')).toMatch(/css/)
    expect(await css.text()).toContain('sla-over')
  })
})
