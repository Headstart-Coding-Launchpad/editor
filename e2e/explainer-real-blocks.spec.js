import { test, expect } from '@playwright/test'
/* global window, document -- only inside page callbacks, which run in Chromium */

// Fun moment: a child reads the explainer, and the Scratch blocks in it look exactly like the
// blocks in their own workspace beside it: same shapes, same size, the C block's arm, foot and
// indent drawn by Scratch's own engine. Runs on the no-session #/shot page (no Firebase).

const FENCE = [
  'when green flag clicked',
  'forever',
  '  next costume',
  '  wait (1) seconds',
  'end',
].join('\n')

// The same script as workspace blocks, so the two pictures can be measured against each other.
const SCRIPT = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'event_whenflagclicked',
        x: 24,
        y: 24,
        next: {
          block: {
            type: 'control_forever',
            inputs: {
              SUBSTACK: {
                block: {
                  type: 'looks_nextcostume',
                  next: {
                    block: {
                      type: 'control_wait',
                      inputs: {
                        DURATION: { shadow: { type: 'math_number', fields: { NUM: '1' } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    ],
  },
}

const LESSON = {
  id: 'e2e-real-blocks',
  type: 'scratch',
  title: 'Real blocks',
  tasks: [
    {
      id: 1,
      title: 'Twinkle',
      explainer: `Make the star twinkle for ever:\n\n\`\`\`scratch\n${FENCE}\n\`\`\`\n\nUnknown lines keep the old picture:\n\n\`\`\`scratch\nwhen green flag clicked\nwiggle [a lot]\n\`\`\``,
      codeStages: [{ label: 'Starter', role: 'starter', blocks: { sprite1: SCRIPT } }],
      check: [{ type: 'block_used', opcode: 'control_forever', hint: 'Use a forever block.' }],
    },
  ],
}

// Size and C-block geometry of the forever block inside `root` (CSS px on screen).
async function foreverGeometry(root) {
  return root.evaluate((el) => {
    const forever = el.querySelector('g.control_forever')
    const path = forever.querySelector(':scope > path.blocklyPath')
    const child = forever.querySelector(':scope > g.looks_nextcostume > path.blocklyPath')
    const p = path.getBoundingClientRect()
    const c = child.getBoundingClientRect()
    return { width: p.width, height: p.height, indent: c.left - p.left, top: c.top - p.top }
  })
}

test.use({ viewport: { width: 1366, height: 768 } })

test('explainer blocks are drawn by Scratch itself and match the workspace', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(
    (data) => {
      window.__HSC_SHOT__ = data
    },
    { lesson: LESSON, taskId: 1 }
  )
  await page.goto('#/shot')

  const real = page.locator('[data-real-blocks="blockly"]').first()
  await expect(real).toBeVisible({ timeout: 30000 })
  // The picture is Blockly's own SVG, not the Markdown renderer's drawing.
  await expect(real.locator('svg path.blocklyPath').first()).toBeVisible()
  await expect(real).toHaveAttribute('aria-label', /forever/)

  // The line Scratch has no block for keeps the Markdown renderer's picture.
  await expect(page.locator('[data-real-blocks="fallback"]')).toHaveCount(1)

  // The workspace's forever block, drawn by the real editor at the same calm size.
  const workspace = page
    .locator('.blocklyWorkspace')
    .filter({ has: page.locator('g.control_forever') })
  await expect(workspace.first()).toBeVisible({ timeout: 30000 })
  const inExplainer = await foreverGeometry(real)
  const inWorkspace = await foreverGeometry(workspace.first())
  for (const key of ['width', 'height', 'indent', 'top']) {
    expect(Math.abs(inExplainer[key] - inWorkspace[key]), key).toBeLessThan(1.5)
  }

  // Every id in the explainer pictures is unique on the page.
  const dupes = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[data-real-blocks] [id]')].map((el) => el.id)
    return ids.filter((id, i) => ids.indexOf(id) !== i)
  })
  expect(dupes).toEqual([])
  expect(errors).toEqual([])
})
