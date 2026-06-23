import { extname } from 'node:path'
import yaml from 'js-yaml'
import { parseYamlLesson, parseYamlTopicLibrary } from './yaml-converter.mjs'

export function parseJson(text) {
  try {
    return JSON.parse(text.trim())
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`)
  }
}

function parseYaml(text) {
  try {
    return yaml.load(text.trim()) ?? {}
  } catch (e) {
    throw new Error(`Invalid YAML: ${e.message}`)
  }
}

function inputExtension(filePath) {
  return filePath ? extname(filePath).toLowerCase() : ''
}

export function parseJsonOrYaml(filePath, text) {
  const ext = inputExtension(filePath)
  if (ext === '.yaml' || ext === '.yml') return parseYaml(text)
  if (ext === '.json') return parseJson(text)

  try {
    return parseJson(text)
  } catch {
    return parseYaml(text)
  }
}

export function parseLessonJsonOrYaml(filePath, text) {
  const ext = inputExtension(filePath)
  if (ext === '.yaml' || ext === '.yml') return parseYamlLesson(text)
  if (ext === '.json') return parseJson(text)

  try {
    return parseJson(text)
  } catch {
    return parseYamlLesson(text)
  }
}

export function parseTopicLibraryJsonOrYaml(filePath, text) {
  const ext = inputExtension(filePath)
  if (ext === '.yaml' || ext === '.yml') return parseYamlTopicLibrary(text)
  if (ext === '.json') return parseJson(text)

  try {
    return parseJson(text)
  } catch {
    return parseYamlTopicLibrary(text)
  }
}

export function parseTopicJsonOrYaml(filePath, text) {
  const input = parseTopicLibraryJsonOrYaml(filePath, text)
  const topics = Array.isArray(input) ? input : input?.topics
  if (Array.isArray(topics)) {
    if (topics.length !== 1) {
      throw new Error(`Expected exactly one topic, received ${topics.length}`)
    }
    return topics[0]
  }
  return input
}
