import { normalizeChecks } from '../modules/checks.js'
import { normalizeFsCheck } from '../modules/filesystem/checks.js'

// Shared between the Builder (src/builder/lessonUtils.js) and the CLI (cli/validate.mjs) so
// the two publish paths can't validate filesystem/electronics checks differently — before
// this was extracted, the CLI only recognised deprecated legacy filesystem check type names
// and had no electronics check validation at all, so a lesson published via the CLI alone
// could ship a check the Builder would have flagged as broken.

export function hasValue(value) {
  return value === 0 || value === false || String(value ?? '').trim() !== ''
}

export function labelCheckKind(kind) {
  return kind === 'feedback' ? 'feedback check' : 'check'
}

export function hasCircuitSelectorTarget(selector) {
  return !!(
    selector?.type?.trim?.() ||
    selector?.componentType?.trim?.() ||
    selector?.typeName?.trim?.() ||
    selector?.label?.trim?.() ||
    selector?.id?.trim?.()
  )
}

export function hasCircuitEndpointTarget(endpoint) {
  return hasCircuitSelectorTarget(endpoint?.component ?? endpoint) && !!endpoint?.pin?.trim?.()
}

export function validateFilesystemChecks(checks, n, errors, kind = 'completion') {
  const label = labelCheckKind(kind)
  const normalized = normalizeChecks(checks).map(normalizeFsCheck)
  if (normalized.some((c) => c.type?.startsWith('fs_') && !c.path?.trim())) {
    errors.push(`Task ${n} has a filesystem ${label} but no path`)
  }
  if (normalized.some((c) => c.type === 'fs_file_content' && !hasValue(c.value))) {
    errors.push(`Task ${n} has a file-content ${label} but no expected value`)
  }
  if (normalized.some((c) => c.type === 'fs_file_line_count' && !hasValue(c.value))) {
    errors.push(`Task ${n} has a file line-count ${label} but no expected count`)
  }
  if (normalized.some((c) => c.type === 'fs_file_location' && !c.dir?.trim())) {
    errors.push(`Task ${n} has a file-location ${label} but no parent folder`)
  }
  if (normalized.some((c) => c.type === 'fs_folder_count' && !hasValue(c.value))) {
    errors.push(`Task ${n} has a folder-count ${label} but no expected count`)
  }
}

export function validateElectronicsChecks(checks, n, errors, kind = 'completion') {
  const label = labelCheckKind(kind)
  const normalized = normalizeChecks(checks)
  if (
    normalized.some(
      (c) => c.type === 'circuit_has_component' && !hasCircuitSelectorTarget(c.component)
    )
  ) {
    errors.push(`Task ${n} has a part-exists ${label} but no part type or label`)
  }
  if (
    normalized.some(
      (c) =>
        (c.type === 'circuit_component_powered' || c.type === 'circuit_component_unpowered') &&
        !hasCircuitSelectorTarget(c.component)
    )
  ) {
    errors.push(`Task ${n} has a powered-part ${label} but no part type or label`)
  }
  if (
    normalized.some(
      (c) =>
        c.type === 'circuit_control_affects_power' &&
        (!hasCircuitSelectorTarget(c.control) || !hasCircuitSelectorTarget(c.component))
    )
  ) {
    errors.push(`Task ${n} has a control ${label} but no control or controlled part`)
  }
  if (
    normalized.some(
      (c) =>
        (c.type === 'circuit_path_exists' || c.type === 'circuit_path_includes') &&
        (!hasCircuitEndpointTarget(c.from) || !hasCircuitEndpointTarget(c.to))
    )
  ) {
    errors.push(`Task ${n} has a circuit connection ${label} but no source or destination part/pin`)
  }
  if (
    normalized.some(
      (c) => c.type === 'circuit_path_includes' && !hasCircuitSelectorTarget(c.includes)
    )
  ) {
    errors.push(`Task ${n} has a circuit connection-includes ${label} but no required part`)
  }
}
