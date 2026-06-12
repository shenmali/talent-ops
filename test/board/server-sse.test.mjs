import { describe, it, expect, afterEach } from 'vitest'
import { createBoardServer } from '../../board/server.mjs'
import { makeRepo, approvedContract } from '../helpers.mjs'

let server
afterEach(() => server?.close())

describe('board SSE', () => {
  it('GET /events opens an event-stream', async () => {
    server = createBoardServer({ root: makeRepo({ 'roles/r/role-contract.md': approvedContract }), userId: 'ali' })
    await new Promise((r) => server.listen(0, r))
    const { port } = server.address()
    const ctrl = new AbortController()
    const res = await fetch(`http://localhost:${port}/events`, { signal: ctrl.signal })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/)
    ctrl.abort() // close the stream so the test can finish
  })
})
