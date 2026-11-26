import net from 'node:net'
import * as Blockly from 'blockly'
import { expect, it, vi } from 'vitest'

// Blockly.inject preloads its click sounds from blockly-demo.appspot.com. On a machine
// that cannot reach it, the rejection is unhandled and the whole suite exits 1.
it('injecting a real Blockly workspace opens no network connection', async () => {
  const targets = []
  // Records and refuses at the socket, so this test never reaches the network itself.
  const connect = vi.spyOn(net.Socket.prototype, 'connect').mockImplementation(function (...args) {
    const options = Array.isArray(args[0]) ? args[0][0] : args[0]
    targets.push(options?.host ?? String(options))
    process.nextTick(() => this.destroy(new Error('network blocked in tests')))
    return this
  })
  const div = document.body.appendChild(document.createElement('div'))
  const workspace = Blockly.inject(div, {})
  await new Promise((resolve) => setTimeout(resolve, 500))
  workspace.dispose()
  div.remove()
  connect.mockRestore()
  expect(targets).toEqual([])
})
