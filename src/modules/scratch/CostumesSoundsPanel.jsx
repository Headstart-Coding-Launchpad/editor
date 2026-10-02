import React, { useState } from 'react'
import EmojiPicker, { EmojiStyle } from 'emoji-picker-react'
import { SYNTH_SOUNDS } from './scratchSounds.js'

// The Costumes and Sounds tabs beside a sprite's Code tab (task flags showCostumesTab /
// showSoundsTab). Each tab lists the selected sprite's costumes or sounds; with
// allowAddCostume / allowAddSound it also offers an "Add" view: emoji or the admin sprite
// library's costumes, and the built-in synth sounds or the admin default sound files.
// ScratchWorkspace owns the sprite data and persistence — this component only renders and
// reports choices back through its callbacks.

export function CostumesTab({
  sprite,
  currentCostume,
  readOnly,
  canAdd,
  libraryCostumes,
  renderCostumeThumb,
  onSelectCostume,
  onAddCostume,
}) {
  const [adding, setAdding] = useState(false)
  const costumes = sprite?.costumes ?? []
  const activeName = currentCostume ?? costumes[0]?.name

  if (adding) {
    return (
      <div style={s.panel}>
        <div style={s.header}>
          <span style={s.title}>Choose a costume</span>
          <button
            type="button"
            className="btn-ghost"
            style={s.smallBtn}
            onClick={() => setAdding(false)}
          >
            Done
          </button>
        </div>
        {libraryCostumes.length > 0 && (
          <>
            <span style={s.sectionLabel}>Library</span>
            <div style={s.grid} role="listbox" aria-label="Library costumes">
              {libraryCostumes.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  role="option"
                  aria-selected={false}
                  style={s.card}
                  title={`Add ${c.name}`}
                  onClick={() => {
                    onAddCostume({
                      name: c.name,
                      ...(c.image ? { image: c.image } : { emoji: c.emoji }),
                    })
                    setAdding(false)
                  }}
                >
                  {c.imageUrl ? (
                    <img src={c.imageUrl} alt="" style={s.thumbImg} />
                  ) : (
                    <span style={s.thumbEmoji}>{c.emoji}</span>
                  )}
                  <span style={s.cardName}>{c.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <span style={s.sectionLabel}>Emoji</span>
        <div style={s.emojiWrap}>
          <EmojiPicker
            onEmojiClick={(emojiData) => {
              // names runs from a short keyword ("face") to the full name ("grinning
              // face"); the longest reads best as a costume name.
              const label =
                (emojiData.names ?? []).reduce((a, b) => (b.length > a.length ? b : a), '') ||
                'emoji'
              onAddCostume({ name: label, emoji: emojiData.emoji })
              setAdding(false)
            }}
            emojiStyle={EmojiStyle.NATIVE}
            previewConfig={{ showPreview: false }}
            width="100%"
            height={320}
          />
        </div>
      </div>
    )
  }

  return (
    <div style={s.panel}>
      <div style={s.header}>
        <span style={s.title}>{sprite?.name} costumes</span>
        {canAdd && (
          <button
            type="button"
            className="btn-primary"
            style={s.smallBtn}
            onClick={() => setAdding(true)}
          >
            + Add costume
          </button>
        )}
      </div>
      {costumes.length === 0 ? (
        <p style={s.empty}>
          This sprite has one look and no costumes yet.
          {canAdd ? ' Add a costume to give it more.' : ''}
        </p>
      ) : (
        <div style={s.grid} role="listbox" aria-label="Costumes">
          {costumes.map((c, i) => {
            const active = c.name === activeName
            return (
              <button
                key={`${c.name}-${i}`}
                type="button"
                role="option"
                aria-selected={active}
                disabled={readOnly}
                style={{ ...s.card, ...(active ? s.cardActive : {}) }}
                title={readOnly ? c.name : `Wear ${c.name}`}
                onClick={() => onSelectCostume(c.name)}
              >
                <span style={s.cardIndex}>{i + 1}</span>
                {renderCostumeThumb(c)}
                <span style={s.cardName}>{c.name}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function SoundsTab({ sprite, sounds, canAdd, audioLibrary, onPreviewSound, onAddSound }) {
  const [adding, setAdding] = useState(false)

  if (adding) {
    return (
      <div style={s.panel}>
        <div style={s.header}>
          <span style={s.title}>Choose a sound</span>
          <button
            type="button"
            className="btn-ghost"
            style={s.smallBtn}
            onClick={() => setAdding(false)}
          >
            Done
          </button>
        </div>
        <span style={s.sectionLabel}>Synth sounds</span>
        <div style={s.list}>
          {SYNTH_SOUNDS.map((synth) => (
            <SoundRow
              key={synth.id}
              icon="🎹"
              name={synth.name}
              onPreview={() => onPreviewSound({ synth: synth.id })}
              onAdd={() => {
                onAddSound({ name: synth.name, synth: synth.id })
                setAdding(false)
              }}
            />
          ))}
        </div>
        {audioLibrary.length > 0 && (
          <>
            <span style={s.sectionLabel}>Sound files</span>
            <div style={s.list}>
              {audioLibrary.map((preset) => (
                <SoundRow
                  key={preset.id}
                  icon="🔊"
                  name={preset.name}
                  onPreview={() => onPreviewSound({ url: preset.url })}
                  onAdd={() => {
                    onAddSound({ name: preset.name, audio: preset.audio })
                    setAdding(false)
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div style={s.panel}>
      <div style={s.header}>
        <span style={s.title}>{sprite?.name} sounds</span>
        {canAdd && (
          <button
            type="button"
            className="btn-primary"
            style={s.smallBtn}
            onClick={() => setAdding(true)}
          >
            + Add sound
          </button>
        )}
      </div>
      <div style={s.list} role="list" aria-label="Sounds">
        {sounds.map((snd, i) => (
          <SoundRow
            key={`${snd.name}-${i}`}
            index={i + 1}
            icon={snd.audio ? '🔊' : '🎹'}
            name={snd.name}
            onPreview={() => onPreviewSound(snd)}
          />
        ))}
      </div>
    </div>
  )
}

function SoundRow({ index, icon, name, onPreview, onAdd }) {
  return (
    <div style={s.soundRow} role="listitem">
      {index != null && <span style={s.cardIndex}>{index}</span>}
      <span style={s.soundIcon} aria-hidden="true">
        {icon}
      </span>
      <span style={s.soundName}>{name}</span>
      <button
        type="button"
        className="btn-ghost"
        style={s.iconBtn}
        onClick={onPreview}
        aria-label={`Play ${name}`}
        title={`Play ${name}`}
      >
        ▶
      </button>
      {onAdd && (
        <button
          type="button"
          className="btn-primary"
          style={s.smallBtn}
          onClick={onAdd}
          aria-label={`Add ${name}`}
        >
          Add
        </button>
      )}
    </div>
  )
}

const s = {
  panel: {
    position: 'absolute',
    inset: 0,
    // Above Blockly's own layers in the same pane (flyout 20, toolbox 70, scrollbars), which
    // otherwise draw over the panel and swallow its clicks.
    zIndex: 80,
    overflowY: 'auto',
    background: '#fff',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontFamily: 'var(--font-body)',
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontWeight: 700, fontSize: '0.9rem', color: 'var(--colour-text)' },
  sectionLabel: {
    fontSize: '0.72rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--colour-muted-soft)',
    marginTop: 4,
  },
  empty: { margin: 0, fontSize: '0.82rem', color: 'var(--colour-muted-soft)' },
  smallBtn: { padding: '3px 10px', fontSize: '0.78rem', minHeight: 0 },
  iconBtn: { padding: '2px 8px', fontSize: '0.78rem', minHeight: 0 },
  grid: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  card: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    width: 78,
    padding: '6px 4px',
    border: '2px solid var(--ui-border-neutral)',
    borderRadius: 8,
    background: '#fff',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
  },
  cardActive: {
    borderColor: 'var(--colour-primary)',
    background: 'var(--colour-primary-soft, #eef2ff)',
  },
  cardIndex: {
    fontSize: '0.66rem',
    fontWeight: 700,
    color: 'var(--colour-muted-soft)',
    minWidth: 12,
  },
  cardName: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'var(--colour-text)',
    maxWidth: 70,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  thumbImg: { width: 44, height: 44, objectFit: 'contain' },
  thumbEmoji: {
    width: 44,
    height: 44,
    fontSize: 30,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiWrap: { flexShrink: 0 },
  list: { display: 'flex', flexDirection: 'column', gap: 4 },
  soundRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 8px',
    border: '1px solid var(--ui-border-neutral)',
    borderRadius: 6,
    background: '#fff',
  },
  soundIcon: { fontSize: '1rem' },
  soundName: { flex: 1, fontSize: '0.82rem', fontWeight: 600, color: 'var(--colour-text)' },
}
