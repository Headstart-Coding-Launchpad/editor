# 'See example' button in explainers that opens a worked example in a pop-up

- **Status:** shipped
- **Kind:** module
- **Requested by:** Ryan (approved by Ryan), 2026-10-14
- **Lessons blocked:** none yet

## Need

Challenge (Open-Ended) explainers show a parallel worked example ('Here's the same Check → Do → Otherwise shape with different weather:' then a 5-line Python block, e.g. uh1nj86w7a '⚽ Any Other Sport?'). The explainer panel is too narrow, so the code wraps and is hard to read. Tutor: 'The same shape in the explainer isn't helpful at the moment - It doesn't fit the panel'. Ryan: valuable, but it doesn't work in the side panel.

Closest existing capability (from `lessons capabilities`): Explainer Markdown (markdown-renderer.md): fenced code blocks render inline in the side panel at its width. Nothing opens content in a wider modal from an explainer.

Current workaround and why it falls short: From guides v35 the worked example is left out of explainers until this ships. Students on an open challenge lose the parallel example that shows the shape without giving the answer.

## Example task

    explainer: |\n  Add an else so any other sport gets a message too.\n  ...\nexample:                 # new optional task field\n  label: See an example  # button text\n  intro: Here's the same Check → Do → Otherwise shape with different weather.\n  code: |\n    weather = "sunny"\n    if weather == "rainy":\n        print("Grab your wellies!")\n    else:\n        print("Sunglasses on!")

## Checks wanted

Session report: whether and when each student opened the example (so reports can see if it helped).

## Notes

Ryan's idea, 2026-10-13. Could be a Markdown directive instead of a task field; dev agent's call.

## Resolution

Shipped on branch `feature/explainer-see-example` as a Markdown fence rather than a task field (the dev agent's call the request allowed): it sits where it's read, works anywhere in an explainer, and allows more than one.

    ```example python label="See an example"
    Here's the same Check → Do → Otherwise shape with different weather.
    ---
    weather = "sunny"
    ...
    ```

- The button opens a wide, portalled dialog (focus kept inside, Esc closes; a bottom sheet on phones) with the intro and highlighted code (`src/shared/markdown/exampleFence.js`, `ExampleFence.jsx`).
- Opens in a task explainer during a live lesson are logged per student, task and example (`exampleOpenLog`, `src/shared/exampleOpens.js`; new RTDB data, approved in the 2026-10-14 plan). The tutor's card shows 🔍 and the student modal "🔍 Opened example".
- Session report: `exampleOpens` per student task (first open, `afterMs`, `opens`) and `exampleOpenStudentCount` per task.
- Validation warns about empty, unknown-language, malformed, unclosed or too many example fences.
- Docs: [markdown-renderer.md](../markdown-renderer.md#worked-examples-see-an-example), [session-reports.md](../session-reports.md), [validation-errors.md](../validation-errors.md), CHANGELOG 2026-10-14.
