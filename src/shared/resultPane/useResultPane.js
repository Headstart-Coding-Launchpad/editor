import { useEffect, useRef, useState } from 'react'
import {
  consoleBadge,
  countOutputLines,
  getTaskLayout,
  initialResultPane,
  paneAfterRun,
  runAnnouncement,
  stacksPictureAndTags,
} from './resultPane.js'

/**
 * A counter that goes up once per finished Run: when `running` goes from true to false, or
 * when `liveKey` (a Go Live viewer's token for the presenter's latest result, e.g. its run
 * status or turtle runId) changes to a new non-empty value.
 */
export function useRunFinishedToken({ running = false, liveKey = null } = {}) {
  const [token, setToken] = useState(0)
  const wasRunning = useRef(running)
  const lastLiveKey = useRef(liveKey)
  useEffect(() => {
    if (wasRunning.current && !running) setToken((n) => n + 1)
    wasRunning.current = running
  }, [running])
  useEffect(() => {
    if (liveKey != null && liveKey !== '' && liveKey !== lastLiveKey.current) {
      setToken((n) => n + 1)
    }
    lastLiveKey.current = liveKey
  }, [liveKey])
  return token
}

/**
 * The tabbed result pane's state (./ResultPane.jsx): which tab shows, whether Picture and Tags
 * stack, the Console's unread badge and the live-region announcement. Rules in ./resultPane.js.
 *
 * - `available`: the panes this task has right now (subset of RESULT_PANES, in order);
 * - `tabbed`: whether the panes are tabs at the moment (false when everything is side by side —
 *   then every pane counts as seen and nothing is announced);
 * - `runToken`: useRunFinishedToken's counter; `drew` / `error` describe that run;
 * - `slowMo`: slow-mo playback is on screen;
 * - `output` / `consoleError`: the Console's text and whether its run failed.
 */
export function useResultPane({
  task = null,
  available = [],
  tabbed = false,
  tagsMode = null,
  pictureGoal = false,
  preferPicture = false,
  slowMo = false,
  runToken = 0,
  drew = false,
  error = false,
  output = '',
} = {}) {
  const firstPane = getTaskLayout(task)?.firstPane ?? null
  const initial = initialResultPane({ available, firstPane, tagsMode, pictureGoal, preferPicture })
  const taskKey = task?.id ?? null
  const [chosen, setChosen] = useState({ taskKey, pane: initial })
  // A new task starts from its own first tab.
  const chosenPane = chosen.taskKey === taskKey ? chosen.pane : initial
  const active = available.includes(chosenPane) ? chosenPane : initial

  const stacked = stacksPictureAndTags({
    available,
    slowMo,
    tagsMode,
    pictureShown: drew || pictureGoal,
  })
  const consoleVisible = !tabbed || active === 'console'

  // Lines the student has seen in the Console; an error marker until the Console is opened.
  const total = countOutputLines(output)
  const [seen, setSeen] = useState(total)
  const [errorUnseen, setErrorUnseen] = useState(false)
  const seenNow = total < seen ? 0 : seen // a new run cleared the output
  useEffect(() => {
    if (consoleVisible) {
      setSeen(total)
      setErrorUnseen(false)
    } else if (total < seen) {
      setSeen(0)
    }
  }, [consoleVisible, total, seen])

  const [announcement, setAnnouncement] = useState('')
  const latest = useRef(null)
  latest.current = {
    available,
    drew,
    error,
    tagsMode,
    pictureGoal,
    slowMo,
    tabbed,
    total,
    taskKey,
  }

  function select(pane) {
    setChosen({ taskKey, pane })
  }

  // After each Run: switch to what the task is about, and say what changed.
  const lastRunToken = useRef(runToken)
  useEffect(() => {
    if (runToken === lastRunToken.current) return
    lastRunToken.current = runToken
    const now = latest.current
    const pane = paneAfterRun(now)
    if (!pane) return
    setChosen({ taskKey: now.taskKey, pane })
    if (!now.tabbed) return
    const hidden = pane !== 'console'
    // A Run clears the output, so when the pane moves away from the Console every line of this
    // run counts as new: the student never had time to read them.
    if (hidden) setSeen(0)
    if (hidden && now.error) setErrorUnseen(true)
    const badge = hidden ? consoleBadge({ total: now.total, seen: 0, error: now.error }) : null
    const isStacked = stacksPictureAndTags({
      available: now.available,
      slowMo: now.slowMo,
      tagsMode: now.tagsMode,
      pictureShown: now.drew || now.pictureGoal,
    })
    const text = runAnnouncement({ pane, stacked: isStacked, badge })
    // The same words twice in a row wouldn't be read again, so alternate a trailing space.
    setAnnouncement((prev) => (prev === text ? `${text}\u00a0` : text))
  }, [runToken])

  // Slow-mo starting shows the Picture and Tags (stacked), or Tags, or the Console.
  const wasSlowMo = useRef(slowMo)
  useEffect(() => {
    if (slowMo && !wasSlowMo.current) {
      const now = latest.current
      const pane = paneAfterRun({ ...now, slowMo: true })
      if (pane) setChosen({ taskKey: now.taskKey, pane })
    }
    wasSlowMo.current = slowMo
  }, [slowMo])

  const badge =
    tabbed && !consoleVisible
      ? consoleBadge({ total, seen: seenNow, error: errorUnseen && error })
      : null

  return { active, select, stacked, badges: badge ? { console: badge } : {}, announcement }
}
