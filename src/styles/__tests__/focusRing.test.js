import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(__dirname, '../../index.css'), 'utf8')
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
  selector: m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim(),
  body: m[2],
}))

describe('keyboard focus ring', () => {
  it('has one global :focus-visible rule that draws a solid primary-colour outline', () => {
    const rule = rules.find((r) => /^:focus-visible(:not\([^)]*\))?$/.test(r.selector))
    expect(rule).toBeTruthy()
    expect(rule.body).toMatch(/outline:\s*3px solid var\(--colour-primary\)/)
    expect(rule.body).toMatch(/outline-offset:\s*2px/)
  })

  it('no :focus-visible rule switches the outline off', () => {
    const bad = rules.filter(
      (r) => /:focus-visible/.test(r.selector) && /outline:\s*none/.test(r.body)
    )
    expect(bad.map((r) => r.selector)).toEqual([])
  })
})
