# Legacy lesson-format compatibility

This reference lists lesson data formats that the application still reads so that existing lessons remain usable. It is a compatibility inventory, not a guide for authoring new lessons. New content should use the current fields named below.

## Scope

The compatibility layer preserves existing single-type lesson documents, task IDs, URLs, local-storage keys, session data, reports, and CLI lesson files. It does not automatically convert a legacy lesson to a `composed` lesson. The Builder opens legacy single-type lessons in compatibility mode; a conversion action has not been introduced.

## Lesson envelope and structure

| Legacy format | Current model | Kept behaviour |
|---|---|---|
| Lesson `type` is `python`, `arcade`, `html`, `scratch`, `filesystem`, or `electronics` | New lessons use `type: composed` and choose a `moduleType` per code task. | The original single-type workspace, task routing, persistence, sandbox, reports, and URLs continue to work. |
| Scalar or object `level` | `levelId` or `levelRef` points to a reusable level. | The level remains readable and displayed; publishing migrates a scalar value when no reusable-level reference exists. Legacy type-scoped levels remain readable. |
| Lesson-envelope sandbox fields such as `sandboxStarter`, `sandboxStarterFiles`, `sandboxToolbox`, `sandboxSprites`, `sandboxBackdrops`, `sandboxStarterFs`, and `sandboxStarterCircuit` | A composed lesson keeps sandbox configuration in `modules[].sandbox`. | Envelope fields still supply the sandbox for legacy single-type lessons. |
| Early composed draft: task `moduleId` resolves through `lesson.modules[]`, with no task `moduleType` | Every composed code task now has `moduleType`; `moduleId` optionally selects a named instance. | The runtime finds the module type from the named legacy module entry. |
| `taskType: draft` placeholder records | Draft is now lesson-level (`draft: true`); tasks have a real type. | Placeholder tasks are retained in stored data but removed from task lists, navigation, progress, counts, and lesson flow. |
| Scratch block trees stored as plain objects in Firestore | New Firestore writes encode deep block trees as JSON strings. | Reads leave legacy object values intact, so old Scratch lessons continue to load. |

## Code-task content and stages

| Legacy format | Current model | Kept behaviour |
|---|---|---|
| Python/Arcade `starterCode` and `completeCode` | `codeStages` with `starter`, `support`, and `complete` roles. | Student, teacher-live, reset, carry-through, preview, print, and sandbox paths still use the old fields when an equivalent stage is absent. Python and HTML's newer authoring UI does not create or edit these fields. |
| HTML `starterFiles`, `completeFiles`, `entryFile`, and `completeEntryFile` | Role-based file stages. | The file sets and entry files still initialise, reset, carry, preview, print, and render legacy HTML tasks. |
| Stage role `core` or `extension` | `support` | Both values resolve as offerable Support stages. |
| Stage role `solution` | `complete` | The stage remains a complete/solution stage. |
| Legacy stage ordering without feedback priorities | `feedbackChecks[].priority` selects the lowest matching value. | When priority is absent, matching feedback keeps its existing array order. |

## Feedback and check shapes

| Legacy format | Normalised to |
|---|---|
| `incorrectChecks` | `feedbackChecks` with the default `mode: blocking`. |
| Feedback `show: on_pause` | `show: on_idle`. |
| `output_contains`, `output_not_contains`, `output_equals`, `output_not_equals`, `output_matches_regex`, `output_not_matches_regex` | `type: output` with the corresponding operator. |
| `output_line_count_at_least` | `type: output_line_count`, `operator: greater_than_or_equal`. |
| `code_contains`, `code_does_not_contain`, `code_not_contains`, `code_equals`, `code_not_equals`, `code_matches_regex`, `code_not_matches_regex` | `type: code` with the corresponding operator. |
| `answer_contains`, `answer_not_contains`, `answer_matches_regex`, `answer_not_matches_regex` | `type: answer` with the corresponding operator. |
| `answer_equals` (a multiple-choice quiz's correctness check) | **Not actually superseded.** `cli/validate.mjs` still requires the literal `check.type === 'answer_equals'` for a multiple-choice quiz to validate as having a correct answer, and `cli/yaml-converter.mjs`'s `answer: <option-id>` shorthand still emits `type: answer_equals`. Converting a multiple-choice quiz's check to `type: answer, operator: equals` makes `lessons validate`/`upsert` reject it and breaks the quiz's correct-answer state — this broke 5 published Python Level 1 lessons in August 2026 after this row was followed literally. Keep `answer_equals` for this specific case until the validator/converter are updated to match. |
| HTML `element_exists`, `element_count`, `element_value`, `element_value_equals`, `element_value_not_contains`, `element_value_not_equals`, `element_value_matches_regex`, `element_value_not_matches_regex`, `element_attribute`, and `element_style_property` | The equivalent `html_element*` check type and default operator. |
| Filesystem `fs_file_exists`, `fs_dir_exists`, `fs_not_exists`, `fs_content_contains`, `fs_content_not_contains`, `fs_content_equals`, `fs_content_matches_regex`, `fs_content_not_matches_regex`, `fs_content_line_count`, `fs_file_in_dir`, `fs_file_count`, `fs_dir_count`, `fs_dir_opened`, and `fs_file_opened` | The corresponding canonical `fs_*` check shape, including default operator and item type. |
| Scratch `variable_equals` | Still evaluated as equality; use `variable_compare` for newly authored comparisons. |
| Scratch `costume_is` | Still evaluated; new lessons use `sprite_property` with `property: costume`. |
| Scratch `evaluation: manual` | Still recognised as a manual check; new lessons should use the current evaluation modes. |

Normalisation records the original check type in `legacyType` where an alias is converted. This preserves the original data for editor round-tripping while the evaluator uses the canonical shape.

## Scratch, Electronics, and workspace state

| Legacy format | Current model | Kept behaviour |
|---|---|---|
| Scratch `predefinedBlocks` | `prebuiltStacks` | Each old one-block definition is converted to a prebuilt stack and merged with current stacks in the toolbox and editor. |
| Scratch workspace props `initialState` and `externalState` | Multi-sprite `initialStates` and `externalStates` | The single-state aliases are converted into the current per-sprite state representation. |
| Serialized Scratch workspace extension reference | The current Scratch runtime no longer uses that extension. | A no-op extension remains registered so saved workspaces that reference it can still open. |
| Electronics task-level `microcontroller` with `starterCode` or `code` | A `microcontroller` component whose `props.code` holds the MicroPython source. | The parser supplies the legacy source to the component, and builder, student, teacher-live, and print views continue to expose it. |
| Asset metadata in `storageAssets` whose file is not present in the Storage-folder listing | Storage-folder listing is the current asset inventory. | Schema-only asset entries are retained in the merged asset list as a compatibility fallback. |
| Teacher-edit HTML session files stored as whole file objects under numeric keys | Text content keyed by encoded filename. | Old entries are decoded as editable `{ name, content, type }` file records. |

## Deliberate boundaries

- Compatibility is primarily read/execute support. New authoring should use `composed` lessons, module-scoped sandboxes, canonical checks, `feedbackChecks`, current stage roles, `prebuiltStacks`, and component-based electronics circuits.
- The platform does not silently translate code or carry state between different module types, and it does not automatically rewrite a legacy single-type lesson into a composed lesson.
- This inventory excludes non-lesson migrations, such as anonymous-identity migration, because they do not change how a lesson format is read.

## Related references

- [Lesson schema](lesson-schema.md) - current lesson and task fields.
- [YAML lesson schema](lesson-schema-yaml.md) - current authoring envelope.
- [Composed lessons specification](../architecture/composed-lessons-spec.md) - compatibility guarantees for the composed-lesson rollout.
