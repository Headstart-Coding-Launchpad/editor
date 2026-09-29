# Mac and Chromebook equivalents for taught keys and right-click

- **Status:** open
- **Kind:** bug
- **Requested by:** Lesson Gen Agent (approved by Ryan), 2026-09-29
- **Lessons blocked:** none yet

## Need

The Keyboard and Mouse activities and the Desktop input checks must treat each platform's equivalent as the key or gesture being taught: Mac fn+delete and Chromebook Alt+Backspace as Delete, the Mac 'delete' key as Backspace, Chromebook Alt+Search as Caps Lock, fn/Search+arrows as Home/End, and Ctrl+click, Alt+click and two-finger clicks as right-click. Families supply their own computers (HSC is online only), and Macs and Chromebooks are common at home. Only 'Ctrl also matches Cmd' is documented today, so the first step is confirming current behaviour.

Closest existing capability (from `lessons capabilities`): Keyboard shortcuts and input_shortcut (Ctrl matches Cmd on a Mac, the only documented equivalence); Keyboard find_key (Delete, CapsLock, Backspace as named keys); Mouse right_click and input_gesture right_click (strict: true turns off touch equivalents). Mac and Chromebook key behaviour isn't documented anywhere.

Current workaround and why it falls short: Teach Windows key names only and have the tutor explain each child's own keyboard. If a Mac or Chromebook child's correct key press doesn't register, they can't pass find_key Delete or CapsLock, input_modifier notCapsLock, or strict right_click checks. That fails Lesson 8 (Shift vs Caps Lock), Lesson 9 (Backspace vs Delete) and Lesson 5 (right-click menus) for those children.

## Checks wanted

First, confirm how each of these behaves today and document it in activities/keyboard.md, activities/mouse.md and desktop.md (at present only "Ctrl also matches Cmd" is documented). Then make each one count as the key or gesture being taught:

| Taught as | Mac | Chromebook | Where it must count |
| --- | --- | --- | --- |
| Backspace | the key labelled "delete" | Backspace | Keyboard `find_key`; `edit_text` (requested separately) |
| Delete | fn + delete | Alt + Backspace | Keyboard `find_key` `Delete`; `input_shortcut` `delete`; `edit_text` `requireKeys` |
| Caps Lock | caps lock | no key: Alt + Search (Launcher) toggles it | Keyboard `find_key` `CapsLock`; `requireShiftForCapitals`; `input_modifier` `caps_lock` and `notCapsLock` |
| Home / End | fn + Left / Right | Search + Left / Right | Keyboard `shortcuts` / `find_key` where used |
| Right-click | Ctrl + click; two-finger click on a trackpad | Alt + click; two-finger tap | Mouse `right_click` (including `touch: block`); `input_gesture` `right_click` with `strict: true` |

- Outcome: a child on a Mac or Chromebook who presses the right key for their machine passes the same item or check a Windows child would.
- Display: the Keyboard activity's key picture (shown after two wrong presses) and its hints name the key as it appears on the child's machine (e.g. "Press delete" on a Mac for Backspace), and the teacher's modal shows which platform the student was on.


## Devices

This request is about devices. Mac (macOS keyboard and trackpad) and Chromebook (ChromeOS keyboard, no Caps Lock or Delete key) as above. Windows keyboards are the reference layout. Tablets are unchanged: the course blocks them (`touch: block`, `strict: true`).


## Notes

Course: Mouse and Keyboard Skills ('Computer Confidence'), ages 7+. New on 29 Sep 2026 from the proposal's §7 Risk 5 (not in the Platform Backlog). Digital Literacy may want it later, but none of its lesson objectives rely on these keys, so it isn't recorded against that course. No effort estimate yet: it depends on what already works.

### Decisions (Ryan, 2026-09-29)

- Step 1: test current behaviour on a real Mac and Chromebook and document it. Named keys already match on `event.key` and right-click on the `contextmenu` event, so most of this may already work; Caps Lock is the main risk.
- Step 2: platform-aware key names in hints and the key picture.
- Approved: a `platform` field (`mac` | `chromeos` | `windows`) in student presence so the teacher modal can show it; document it in `docs/agents/runtime-model.md`.

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->
