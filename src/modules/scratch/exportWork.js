// "Export work" for Scratch tasks (see src/shared/exportWork/exporters.js):
// - a real .sb3 for Scratch 3 (./export/sb3Translator.js, ./export/sb3Assets.js), listing any
//   blocks it couldn't map, plus a LaunchPad JSON copy of the raw state;
// - pictures: the stage, each sprite's scripts as blocks, and every costume;
// - a share link that opens the project read-only in the Scratch workspace (green flag works).
import { parseScratchState } from '../../shared/workspaceData'
import { canvasToPngBytes } from '../../shared/exportWork/pictures.js'
import { slugifyTitle } from '../../shared/exportWork/naming.js'
import { resolveScratchProject, spriteCostumes } from './export/projectModel.js'
import { buildSb3, drawCostumeCanvas, loadProjectImages } from './export/sb3Assets.js'
import { renderStagePng } from './export/stagePicture.js'
import { renderScriptPictures } from './export/scriptPictures.js'
import ShareView from './ShareView.jsx'

const PICTURE_COSTUME_PX = 256

// Task fields the read-only viewer needs to rebuild the workspace (no checks, stages or answers).
const SHARE_TASK_FIELDS = [
  'id',
  'title',
  'sprites',
  'backdrops',
  'variables',
  'toolbox',
  'enableStageCode',
  'showCostumesTab',
  'showSoundsTab',
]

export function shareTaskFields(task) {
  return Object.fromEntries(
    SHARE_TASK_FIELDS.filter((key) => task?.[key] !== undefined).map((key) => [key, task[key]])
  )
}

function readState(raw) {
  const state = parseScratchState(raw)
  return state && typeof state === 'object' && Object.keys(state).length ? state : null
}

// The model and images are shared by the .sb3 and the pictures of one item.
const prepared = new WeakMap()
function prepare(item, ctx, notes) {
  if (!prepared.has(item)) {
    const model = resolveScratchProject(item.task, item.work.state, item.work.spriteState)
    prepared.set(
      item,
      loadProjectImages(model, ctx.assetsPath, notes).then((images) => ({ model, images }))
    )
  }
  return prepared.get(item)
}

function part(name) {
  return slugifyTitle(name) || 'sprite'
}

const scratchExporter = {
  readLive(student) {
    const state = readState(student?.currentCode)
    return state ? { state, spriteState: student?.currentSpriteState ?? null } : null
  },
  readSubmission(submission) {
    const state = readState(submission)
    return state ? { state, spriteState: null } : null
  },
  async buildFiles(item, ctx) {
    const notes = []
    const { model, images } = await prepare(item, ctx, notes)
    const { sb3, unmapped } = await buildSb3({ model, assetsPath: ctx.assetsPath, images, notes })
    const title = item.task.title || 'A task'
    if (unmapped.length) {
      notes.push(
        `${title}: left out of the .sb3 (no Scratch 3 match): ${unmapped
          .map(({ opcode, count }) => (count > 1 ? `${opcode} ×${count}` : opcode))
          .join(', ')}.`
      )
    }
    const files = [{ name: `${ctx.stem}.sb3`, data: sb3 }]
    if (ctx.includeLaunchPadCopy !== false) {
      files.push({
        name: `${ctx.stem}.launchpad-scratch.json`,
        data: JSON.stringify(
          {
            format: 'headstart-launchpad-scratch',
            version: 1,
            title: item.task.title ?? '',
            task: shareTaskFields(item.task),
            state: item.work.state,
          },
          null,
          2
        ),
      })
    }
    return { files, notes }
  },
  async buildPictures(item, ctx) {
    const notes = []
    const { model, images } = await prepare(item, ctx, notes)
    const files = [
      {
        name: `${ctx.stem}_stage.png`,
        data: await renderStagePng(model, { assetsPath: ctx.assetsPath, images }),
      },
    ]
    for (const picture of await renderScriptPictures(model, { notes })) {
      files.push({ name: `${ctx.stem}_scripts_${part(picture.label)}.png`, data: picture.png })
    }
    for (const sprite of model.sprites) {
      for (const costume of spriteCostumes(sprite)) {
        const canvas = drawCostumeCanvas(
          sprite,
          costume,
          images,
          ctx.assetsPath,
          PICTURE_COSTUME_PX
        )
        files.push({
          name: `${ctx.stem}_costume_${part(sprite.name)}_${part(costume.name)}.png`,
          data: await canvasToPngBytes(canvas),
        })
      }
    }
    if (!item.work.spriteState) {
      notes.push(
        `${item.task.title || 'A task'}: the stage shows where the sprites start (the tutor hadn't watched this run).`
      )
    }
    return { files, notes }
  },
  sharePayload(item, ctx) {
    return {
      state: item.work.state,
      task: shareTaskFields(item.task),
      assetsPath: ctx.assetsPath || '',
    }
  },
  ShareView,
}

export default scratchExporter
