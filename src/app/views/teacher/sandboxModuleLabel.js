import { getModuleDefinition } from '../../../modules/definitions'

// A sandbox module's name in the tutor's "Sandbox module" picker: its title with the module's
// own label, never the raw type twice ("python (python)"; HSC Audit, Visual Review 24).
export function sandboxModuleLabel(module) {
  const type = String(module?.type ?? '')
  const typeLabel = getModuleDefinition(type)?.meta?.label ?? type
  const title = String(module?.title ?? '').trim()
  if (!title || title.toLowerCase() === type.toLowerCase()) return typeLabel || module?.id || ''
  if (!typeLabel || title.toLowerCase() === typeLabel.toLowerCase()) return title
  return `${title} (${typeLabel})`
}
