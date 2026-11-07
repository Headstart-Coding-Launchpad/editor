import { describe, expect, it } from 'vitest'
import { PYTHON_COMMON_KEYS, PYTHON_KEY_SYMBOLS, pythonKeyRows, taskKeyCode } from '../keyRow.js'

// The calm code screen's key row: one row of main keys (the task's own symbols first, then the
// common ones), the rest behind "More keys".
describe('pythonKeyRows', () => {
  it("puts the symbols the task's own code needs in the main row, then common keys", () => {
    const { main, more } = pythonKeyRows("scores = {'a': [1, 2]}  # 50%", 12)
    for (const key of ['[', ']', '#', '%', "'", '{', '}']) expect(main).toContain(key)
    expect(main).toContain('(')
    expect(main.length).toBeLessThanOrEqual(12)
    expect(more.some((key) => main.includes(key))).toBe(false)
    expect([...main, ...more].sort()).toEqual([...PYTHON_KEY_SYMBOLS].sort())
  })

  it("keeps the task's own symbols when the row is short", () => {
    const { main } = pythonKeyRows("x = {'a': [1]}  # 5%", 5)
    expect(main).toHaveLength(5)
    for (const key of main) expect(['[', ']', '#', '%', "'", '{', '}', '=', ':']).toContain(key)
  })

  it('a plain task gets the common keys, in their usual order', () => {
    expect(pythonKeyRows('print("hi")', 8).main).toEqual([...PYTHON_COMMON_KEYS])
  })

  it('counts Tab as needed when the code indents a line', () => {
    expect(pythonKeyRows('for i in x:\n    print(i)', 3).main).toContain('Tab')
  })

  it("reads the task's complete code, code stages and Type this out text", () => {
    const code = taskKeyCode({
      completeCode: 'a = [1]',
      copyCode: 'b # c',
      codeStages: [{ code: 'd % 2' }],
    })
    expect(code).toContain('[')
    expect(code).toContain('#')
    expect(code).toContain('%')
    expect(taskKeyCode(null)).toBe('')
  })
})
