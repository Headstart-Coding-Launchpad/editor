# UI Style Guide

Use this guide before adding or changing UI elements. It documents the design language that already exists in the app, where to reuse existing primitives, and how to keep classroom, builder, and admin surfaces feeling like one product.

## Design Goals

Headstart Coding should feel friendly, clear, and work-focused. The visual system is intentionally bright enough for students, but structured enough for teachers and admins working quickly during a live class.

- Keep primary workflows dense and scannable. Avoid marketing-page layouts inside app surfaces.
- Prefer existing shared components and global classes before adding new styling.
- Use the brand purple for structure and navigation, and the brand amber for primary forward actions.
- Make code, lesson content, and live status the visual priority. Decoration should not compete with the workspace.
- Keep interaction states visible: hover, active, disabled, focus, loading, success, warning, and error.

## Current Theme

The global theme lives in [src/index.css](../src/index.css). New UI should use these CSS custom properties instead of hardcoded equivalents.

| Token | Use |
|---|---|
| `--colour-primary` | Brand purple; headers, selected tabs, secondary commands, key outlines |
| `--colour-primary-dark` | Purple hover/gradient depth |
| `--colour-secondary` | Brand amber; main forward action |
| `--colour-secondary-dark` | Amber hover/gradient depth |
| `--colour-text` | Default body text |
| `--colour-text-on-primary` | Text on purple surfaces |
| `--colour-text-on-secondary` | Text on amber surfaces |
| `--font-title` | Product names, page titles, compact headings |
| `--font-body` | UI labels, body text, controls |
| `--font-code` | Code, file names, generated IDs, URLs |
| `--ui-radius` | Standard 8px radius for buttons, panels, tabs, modals |
| `--ui-radius-sm` | Compact 6px radius for inputs and small controls |
| `--ui-border` | Default light border |
| `--ui-border-strong` | Stronger purple-tinted border |
| `--ui-surface` | White surface |
| `--ui-surface-soft` | Subtle page or panel tint |
| `--ui-surface-tint` | Purple-tinted selected/hover surface |
| `--ui-shadow` | Elevated overlays and modals |
| `--ui-shadow-soft` | Hover and low-elevation surfaces |
| `--ui-focus` | Accessible focus ring |
| `--ui-motion` | Default transition timing |

### Neutral ramp

| Token | Use |
|---|---|
| `--colour-muted` | Muted body/label text |
| `--colour-muted-soft` | Secondary muted text, placeholders, empty states |
| `--colour-ink-strong` | Emphasised dark text on light surfaces |
| `--ui-border-neutral` | Default grey divider or border |
| `--ui-border-neutral-strong` | Stronger grey border |
| `--ui-surface-neutral` | Subtle grey surface |
| `--ui-surface-neutral-sunk` | Recessed grey surface |

These hold the values the app was already typing by hand, so adopting them changes nothing on screen.

**Open decision:** `--ui-border` (purple-tinted `#e6e0f0`) and `--ui-border-neutral` (grey `#e5e7eb`) currently do the same job in different places, which is why panels do not always read as one product. Unifying them is a design decision rather than a refactor and has not been made.

### Status families

| Token | Use |
|---|---|
| `--colour-success` / `-edge` / `-text` / `-bg` | Pass, online, complete |
| `--colour-error` / `-edge` / `-text` / `-bg` | Fail, offline, destructive |
| `--colour-warning` / `-edge` / `-text` / `-bg` | Waiting, paused, attention needed |
| `--colour-info` / `-edge` / `-text` / `-bg` | Neutral preview and information states |

**Green and red are reserved for verdicts.** If an element is not reporting an outcome — pass/fail, online/offline, destructive — it must not use the success or error families. Decorative colour is fine, and should be drawn from anywhere but these two: multiple-choice quiz options are deliberately colour-coded by position, in blue, violet, cyan and pink, precisely so that a bright board can never be confused with a judged one. The palette they replaced took two of its four entries from the verdict families and used the same palette for the selected fill, which made a selected answer pixel-identical to a wrong one.

## Typography

- Use `var(--font-title)` only for product branding, major page titles, and compact panel headings.
- Use `var(--font-body)` for labels, body copy, buttons, table text, and form controls.
- Use `var(--font-code)` for code snippets, file names, generated IDs, URLs, task IDs, and fixed-width output.
- Keep headings proportional to their container. Small panels and cards should not use hero-sized type.
- Do not use negative letter spacing. Existing all-caps micro-labels use small positive letter spacing for table headers and badges.

## Layout

The app has three main UI modes:

| Surface | Pattern |
|---|---|
| Classroom | Full-height workspace with top bar, navigation, task content, editor/preview, and teacher live panels |
| Builder | Dense tool surface with panes, task editor sections, tabs, preview panels, and modals |
| Admin | Centered management shell with header, tab navigation, tables, forms, filters, and empty states |

General layout rules:

- Use full-height flex layouts for app workspaces.
- Use constrained centered content for admin pages (`maxWidth` around 1100px is the existing pattern).
- Use 8px to 16px gaps inside panels and toolbars; use 24px to 32px page padding for admin-level surfaces.
- Cards are for repeated items, selected choices, modal content, and framed tools. Do not nest decorative cards inside cards.
- Keep fixed-format controls stable with explicit width, height, min-width, or grid constraints so labels and hover states do not shift layout.
- Prefer responsive wrapping over overflow for action rows.

## Reusable UI Primitives

Check for these before creating a new element.

| Need | Reuse |
|---|---|
| Route or panel loading state | `LoadingScreen` in [src/app/components/LoadingScreen.jsx](../src/app/components/LoadingScreen.jsx) |
| Notification strip | `Banner` in [src/shared/Banner.jsx](../src/shared/Banner.jsx) |
| Admin section, table, cell, message, badge | [src/admin/AdminUi.jsx](../src/admin/AdminUi.jsx) |
| Code editor | `CodeEditor` in [src/shared/CodeEditor.jsx](../src/shared/CodeEditor.jsx) |
| Markdown editing/preview | `MarkdownFieldEditor` in [src/shared/MarkdownFieldEditor.jsx](../src/shared/MarkdownFieldEditor.jsx) |
| Split panes | `SplitPane` in [src/shared/SplitPane.jsx](../src/shared/SplitPane.jsx) |
| Asset browsing or picking | `AssetBrowser` / `AssetPicker` in [src/shared](../src/shared) |
| Builder field wrappers and code tabs | `Field`, `CodeWorkspaceTabs`, `Modal` in [src/builder/components/task-editor/TaskEditorFields.jsx](../src/builder/components/task-editor/TaskEditorFields.jsx) |
| Teacher code tabs | `TeacherCodeTabs` in [src/app/components/TeacherCodeTabs.jsx](../src/app/components/TeacherCodeTabs.jsx) |
| Presence state | `PresenceBadge` in [src/app/components/PresenceBadge.jsx](../src/app/components/PresenceBadge.jsx) |
| Student editor header | `StudentEditorHeader` in [src/app/components/StudentEditorHeader.jsx](../src/app/components/StudentEditorHeader.jsx) |

If a new primitive is useful in more than one surface, put it in `src/shared/`. If it is admin-only, keep it in `src/admin/AdminUi.jsx`. If it is builder-only, place it near the builder editor modules and use the existing `te-` class namespace.

## Buttons

Global button behaviour is defined in [src/index.css](../src/index.css). Use these classes consistently:

| Class | Use |
|---|---|
| `btn-primary` | Main forward action on the current surface, such as Run, Start, Save, Create, Publish |
| `btn-secondary` | Important secondary action, especially purple actions in teacher/admin surfaces |
| `btn-ghost` | Low-emphasis action on coloured or tool surfaces |
| `btn-ghost-outline` | Low-emphasis action on white/light surfaces |
| `btn-danger` | Destructive or irreversible action |
| `btn-paused` | Existing animated paused-session state |

Guidelines:

- Every interactive command should be a real `button` unless it navigates to another route.
- Keep labels action-oriented: `Save`, `Run`, `Reset`, `Delete`, `Publish`.
- Use `disabled` for unavailable actions and keep the reason visible nearby when it is not obvious.
- Keep destructive actions red and separated from routine actions when possible.
- Do not create one-off button colours for normal commands.

## Forms

Global `input`, `textarea`, and `select` styles already set borders, radius, focus ring, fonts, and select affordances.

- Use labels for every input. The builder's `Field` helper is the preferred local pattern.
- Use `te-input` and `te-select` inside builder task editor surfaces.
- Use `adminUiStyles.filterInput` for admin filters.
- Use `var(--font-code)` for file paths, lesson IDs, raw YAML/JSON, URLs, and code-like values.
- Use inline validation messages near the field, with red for blocking errors and muted text for helper copy.
- For binary settings, use checkboxes or toggles. For mutually exclusive modes, use tabs, radio cards, or segmented controls.

## Tabs And Segmented Controls

Use `.ui-tabs` and `.ui-tab` for tab-like switching. Use `.ui-tabs--editor` when the tabs attach to an editor or workspace panel.

- Set `role="tablist"` on the container and `role="tab"` plus `aria-selected` on tab buttons.
- Use `is-active` where state is managed by class names.
- Keep tab labels short. If labels are code-specific, add `ui-tab--code`.
- Use tabs for changing views within the same context, not for destructive commands.

## Panels, Popovers, And Modals

- Use `.ui-popover` for dropdown menus, floating send menus, and short contextual pickers.
- Use `.ui-collapsible` and `.ui-collapsible__header` for reusable collapsible panels.
- Builder-style full modals should reuse `.te-modal-backdrop`, `.te-modal`, `.te-modal__header`, `.te-modal__title`, and `.te-modal__body`.
- Generic dialogs should use `role="dialog"` and `aria-modal="true"` so the global dialog styling applies.
- Provide a labelled close button with `aria-label` or `title`.
- Keep modal headers purple when using the global dialog pattern, and reserve large modals for editor-like workflows.

## Tables, Lists, And Empty States

Admin tables should use `AdminTable`, `AdminCell`, `AdminMessage`, `AdminBadge`, and `AdminLessonIdPill` from [src/admin/AdminUi.jsx](../src/admin/AdminUi.jsx).

- Table headers use uppercase muted text with compact padding.
- Keep row actions compact and aligned to the right or in the final cell.
- Use `AdminMessage` for loading, empty, muted, and error states.
- Repeated classroom/student items should use compact cards only when each item has independent status or actions.

## Status, Feedback, And Notifications

Reuse existing status elements:

- `.status-dot`, `.status-dot--success`, `.status-dot--error`, `.status-dot--idle` for compact status.
- `.presence-badge` variants for student connection state.
- `.live-dot` for teacher live broadcast state.
- `CheckFeedbackBanner` for student check results.
- `TaskCheckResults` for builder check results.
- `TeacherPreviewBanner`, `TeacherSandboxBanner`, and `StudentStatusBanners` for live-session workflow state.

Recommendations:

- Use green only for success/pass/online.
- Use red only for error/fail/offline/destructive.
- Use amber for waiting, paused, sandbox warning, or "attention needed".
- Use blue for neutral preview/info states.
- Keep feedback text short and close to the thing it describes.

## Icons And Visual Affordances

The app currently uses inline SVGs in places such as `TaskEditorFields.jsx` and domain visuals in Scratch/Electronics. There is no icon library dependency in `package.json`.

- Do not add an icon dependency without confirmation.
- When adding a local icon, prefer an inline SVG helper next to the component if it is domain-specific.
- Use familiar symbols for compact actions where existing code already does so, and always provide `title` or `aria-label` for icon-only buttons.
- Do not use decorative images, gradients, or blobs in dense app surfaces.

## CSS Organization

Current CSS class namespaces:

| Prefix | Scope |
|---|---|
| `btn-` | Global button variants |
| `ui-` | Global primitives: tabs, popovers, collapsibles |
| `hsc-` | Branded shared app elements, currently loading |
| `sv-` | Student view extracted components |
| `te-` | Task editor and builder-style editor components |
| `teacher-` | Teacher view/session components |
| `presence-` | Student presence badges |

Guidelines:

- Put reusable app-wide classes in `src/index.css` with the `ui-` or component namespace.
- Keep local one-off layout styles inside the component only when they are not reusable.
- If a style starts being copied across files, promote it to a shared class or component.
- Avoid `!important` in new CSS unless overriding a legacy global rule. Existing globals use it heavily, so new shared styles should be tested in context.
- Prefer CSS variables over repeating hex values.

## Accessibility

- Use semantic HTML: `button`, `nav`, `main`, `section`, `table`, `label`, `input`, `select`.
- Add `aria-live="polite"` for loading or async status updates, following `LoadingScreen`.
- Dialogs need `role="dialog"` and `aria-modal="true"`.
- Tab controls need `role="tablist"`, `role="tab"`, and `aria-selected`.
- Icon-only controls need an accessible name.
- Maintain visible focus states through the global `--ui-focus` ring.
- Do not rely on colour alone; pair status colours with text, icons, dots, or labels.

## How To Add A UI Element

1. Identify the surface: classroom, builder, admin, shared, or lesson module.
2. Search for an existing component or class that already matches the need.
3. Reuse global tokens and button/tab/form primitives before adding CSS.
4. Place new shared primitives in `src/shared/`, admin primitives in `src/admin/AdminUi.jsx`, and builder-specific primitives near `src/builder/components/`.
5. Use the correct namespace for any new CSS.
6. Include all interaction states: default, hover, active/current, focus, disabled, loading, empty, success, warning, and error as relevant.
7. Check responsive behaviour at narrow widths; action rows should wrap cleanly and text should not overlap.
8. Add or update tests when behaviour changes.
9. Run `npm run docs:check` when docs or source files change, and `npm test` before handing work back.

## Recommendations

These are the current opportunities for consistency based on the existing UI:

- Promote repeated inline admin/button sizing styles into `AdminUi.jsx` helpers as admin panels continue to grow.
- Prefer `LoadingScreen` for all lazy route and panel loading states; avoid plain text loading messages.
- Use `.ui-tabs` for every tab/segmented control instead of local tab styling.
- Reuse `Banner` or existing workflow banners instead of creating new notification strips.
- Consolidate modal shells over time. Builder modals and generic `[role="dialog"]` modals are both established; new modals should pick one intentionally.
- Keep future builder controls inside the `te-` namespace and reuse `Field`, `CodeWorkspaceTabs`, `te-input`, and `te-select`.
- Consider extracting a shared `Field` primitive if labelled field layouts are needed outside the builder.
