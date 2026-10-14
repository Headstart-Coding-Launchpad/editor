import { afterEach, describe, expect, it } from 'vitest'
import { describeElement, explainProperty, rankDeclarations, REASONS } from '../cascade'

function page(css, body) {
  document.head.innerHTML = `<style>${css}</style>`
  document.body.innerHTML = body
}

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

const BODY = `
  <div class="card" id="wrap">
    <p id="a" class="intro">Hi</p>
    <p id="b" style="color: purple">Inline</p>
    <span id="s">Plain</span>
  </div>`

describe('explainProperty', () => {
  it('puts the more specific rule first and says the other is less specific', () => {
    page('p { color: red; } .card p { color: blue; }', BODY)
    const result = explainProperty(document.getElementById('a'), 'color')
    expect(result.source).toBe('set')
    expect(result.entries.map((entry) => [entry.selector, entry.status])).toEqual([
      ['.card p', 'winner'],
      ['p', 'loser'],
    ])
    expect(result.entries[0].specificity).toEqual([0, 1, 1])
    expect(result.entries[1].reason).toEqual({ key: 'specificity', text: REASONS.specificity })
  })

  it('lets the later of two equal rules win, "earlier in the file"', () => {
    page('.intro { color: red; } .intro { color: blue; }', BODY)
    const [winner, loser] = explainProperty(document.getElementById('a'), 'color').entries
    expect(winner.values.color).toBe('blue')
    expect(loser.values.color).toBe('red')
    expect(loser.reason.text).toBe('earlier in the file')
  })

  it('lets !important beat a more specific rule', () => {
    page('p { color: red !important; } .card p { color: blue; }', BODY)
    const [winner, loser] = explainProperty(document.getElementById('a'), 'color').entries
    expect(winner.selector).toBe('p')
    expect(winner.important.color).toBe(true)
    expect(loser.selector).toBe('.card p')
    expect(loser.reason.text).toBe(REASONS.important)
  })

  it('lets the style attribute beat every rule', () => {
    page('#b { color: red; }', BODY)
    const [winner, loser] = explainProperty(document.getElementById('b'), 'color').entries
    expect(winner.kind).toBe('inline')
    expect(loser.selector).toBe('#b')
    expect(loser.reason.key).toBe('inline')
  })

  it('reports an inherited property from the nearest parent that sets it', () => {
    page('.card { color: navy; }', BODY)
    const result = explainProperty(document.getElementById('s'), 'color')
    expect(result.source).toBe('inherited')
    expect(result.entries).toEqual([])
    expect(result.inherited.from).toBe('div#wrap.card')
    expect(result.inherited.entries[0].selector).toBe('.card')
  })

  it("doesn't inherit properties that don't pass down", () => {
    page('.card { background-color: navy; }', BODY)
    expect(explainProperty(document.getElementById('s'), 'background-color').source).toBe('default')
  })

  it('treats a shorthand rule as setting every side', () => {
    page('.card p { margin: 4px; } p { margin-top: 10px; }', BODY)
    const result = explainProperty(document.getElementById('a'), 'margin')
    expect(result.entries[0].selector).toBe('.card p')
    expect(result.entries[0].status).toBe('winner')
    expect(result.entries[1].selector).toBe('p')
    expect(result.entries[1].reason.text).toBe(REASONS.specificity)
  })

  it('skips selectors with pseudo-elements and ones that do not match', () => {
    page('p::before { color: red; } span { color: green; } .intro { color: blue; }', BODY)
    const result = explainProperty(document.getElementById('a'), 'color')
    expect(result.entries.map((entry) => entry.selector)).toEqual(['.intro'])
  })

  it('counts stylesheets it cannot read (cross-origin) and carries on', () => {
    const sheet = (rules) => ({ cssRules: rules, ownerNode: { tagName: 'STYLE' } })
    const style = (values) => ({
      getPropertyValue: (name) => values[name] ?? '',
      getPropertyPriority: () => '',
    })
    const doc = {
      styleSheets: [
        {
          get cssRules() {
            throw new Error('SecurityError')
          },
        },
        sheet([{ selectorText: 'p', style: style({ color: 'red' }) }]),
      ],
      defaultView: null,
    }
    const el = {
      tagName: 'P',
      ownerDocument: doc,
      matches: (selector) => selector === 'p',
      style: style({}),
      getAttribute: () => null,
      parentElement: null,
    }
    const result = explainProperty(el, 'color')
    expect(result.skippedSheets).toBe(1)
    expect(result.entries.map((entry) => entry.selector)).toEqual(['p'])
  })
})

describe('rankDeclarations', () => {
  const decl = (id, specificity, order, values, important = {}) => ({
    id,
    kind: 'rule',
    specificity,
    order,
    sheetIndex: 0,
    values,
    important,
  })

  it('marks a rule that wins only some sides as partial', () => {
    const ranked = rankDeclarations(
      [
        decl('a', [0, 1, 0], 0, { 'margin-top': '4px', 'margin-left': '4px' }),
        decl('b', [0, 2, 0], 1, { 'margin-top': '9px' }),
      ],
      ['margin-top', 'margin-left']
    )
    expect(ranked.map((entry) => [entry.id, entry.status])).toEqual([
      ['b', 'winner'],
      ['a', 'partial'],
    ])
    expect(ranked[1].winsFor).toEqual(['margin-left'])
    expect(ranked[1].reason.text).toBe(REASONS.specificity)
  })

  it('says "loaded earlier" when the winner is in a later stylesheet', () => {
    const ranked = rankDeclarations(
      [
        decl('a', [0, 1, 0], 0, { color: 'red' }),
        { ...decl('b', [0, 1, 0], 5, { color: 'blue' }), sheetIndex: 1 },
      ],
      ['color']
    )
    expect(ranked[1].reason.text).toBe(REASONS.orderOtherFile)
  })
})

describe('describeElement', () => {
  it('joins tag, id and classes', () => {
    document.body.innerHTML = '<section id="top" class="hero big"></section>'
    expect(describeElement(document.getElementById('top'))).toBe('section#top.hero.big')
  })
})
