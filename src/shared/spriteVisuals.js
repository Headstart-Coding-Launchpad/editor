// How a Scratch sprite is being drawn, derived from what its costumes carry. Both the
// admin shared-asset panel and the builder's sprite editor need this to decide which
// editing controls to show.
export function spriteVisualMode(sp) {
  if (sp.costumes?.some((c) => c.image !== undefined)) return 'costume'
  if (sp.emoji || sp.costumes?.some((c) => c.emoji !== undefined)) return 'emoji'
  return 'preset'
}
