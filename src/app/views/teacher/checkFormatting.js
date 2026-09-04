export function formatCheckValue(c) {
  // Output
  if (c.type === 'output_contains') return `output contains "${c.value}"`
  if (c.type === 'output_not_contains') return `output does not contain "${c.value}"`
  if (c.type === 'output_equals') return `output equals "${c.value}"`
  if (c.type === 'output_not_equals') return `output does not equal "${c.value}"`
  if (c.type === 'output_matches_regex') return `output matches /${c.value}/`
  if (c.type === 'output_line_count') return `${c.value} output line${c.value === 1 ? '' : 's'}`
  if (c.type === 'output_line_count_at_least')
    return `at least ${c.value} output line${c.value === 1 ? '' : 's'}`
  if (c.type === 'output_not_empty') return 'output is not empty'
  if (c.type === 'output_empty') return 'output is empty'
  // Code
  if (c.type === 'code_contains') return `code contains "${c.value}"`
  if (c.type === 'code_does_not_contain') return `code does not contain "${c.value}"`
  if (c.type === 'code_equals') return `code equals "${c.value}"`
  if (c.type === 'code_not_equals') return `code does not equal "${c.value}"`
  if (c.type === 'code_matches_regex') return `code matches /${c.value}/`
  // Variable
  if (c.type === 'variable_exists') return `variable "${c.name}" exists`
  if (c.type === 'variable_type') return `variable "${c.name}" is ${c.value}`
  if (c.type === 'variable_equals') return `variable "${c.name}" equals ${c.value}`
  if (c.type === 'variable_dict_contains') return `variable "${c.name}" dict contains ${c.value}`
  if (c.type === 'variable_dict_equals') return `variable "${c.name}" dict equals ${c.value}`
  if (c.type === 'variable_dict_key_value')
    return `variable "${c.name}"["${c.key}"] equals ${c.value}`
  if (c.type === 'variable_array_contains') return `variable "${c.name}" array contains ${c.value}`
  if (c.type === 'variable_array_equals') return `variable "${c.name}" array equals ${c.value}`
  if (c.type === 'variable_array_nth_item')
    return `variable "${c.name}"[${c.index}] equals ${c.value}`
  // Element
  if (c.type === 'element_exists') return `element "${c.selector}" exists`
  if (c.type === 'element_count') return `${c.value} elements matching "${c.selector}"`
  if (c.type === 'element_value') return `"${c.selector}" contains "${c.value}"`
  if (c.type === 'element_value_equals') return `"${c.selector}" equals "${c.value}"`
  if (c.type === 'element_value_not_contains')
    return `"${c.selector}" does not contain "${c.value}"`
  if (c.type === 'element_value_not_equals') return `"${c.selector}" does not equal "${c.value}"`
  if (c.type === 'element_value_matches_regex') return `"${c.selector}" matches /${c.value}/`
  if (c.type === 'element_attribute')
    return c.value
      ? `"${c.selector}" [${c.attribute}]="${c.value}"`
      : `"${c.selector}" has [${c.attribute}]`
  if (c.type === 'element_style_property')
    return c.value
      ? `"${c.selector}" ${c.property}: ${c.value}`
      : `"${c.selector}" has ${c.property}`
  // Quiz
  if (c.type === 'answer_equals') return `answer equals "${c.value}"`
  if (c.type === 'answer_contains') return `answer contains "${c.value}"`
  if (c.type === 'answer_not_contains') return `answer does not contain "${c.value}"`
  if (c.type === 'answer_matches_regex') return `answer matches /${c.value}/`
  if (c.type === 'quiz_result') return 'all pairs / blanks correct'
  // Filesystem
  if (c.type === 'fs_file_exists') return `file exists: ${c.path}`
  if (c.type === 'fs_dir_exists') return `dir exists: ${c.path}`
  if (c.type === 'fs_not_exists') return `not exists: ${c.path}`
  if (c.type === 'fs_content_contains') return `${c.path} contains "${c.value}"`
  if (c.type === 'fs_content_equals') return `${c.path} equals "${c.value}"`
  if (c.type === 'fs_file_in_dir') return `${c.path} in ${c.dir}`
  if (c.type === 'fs_dir_opened') return `dir opened: ${c.path}`
  if (c.type === 'fs_file_opened') return `file opened: ${c.path}`
  // Fallback
  return (
    [c.name && `name: ${c.name}`, c.value != null && `value: ${c.value}`]
      .filter(Boolean)
      .join(', ') ||
    (c.type ?? '')
  )
}
