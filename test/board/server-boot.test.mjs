import { describe, it, expect, afterEach } from 'vitest'
import { createBoardServer } from '../../board/server.mjs'

let server
afterEach(() => server?.close())

describe('board server boot', () => {
  it('serves /healthz', async () => {
    server = createBoardServer({ root: process.cwd() })
    await new Promise((r) => server.listen(0, r))
    const { port } = server.address()
    const res = await fetch(`http://localhost:${port}/healthz`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })
})
