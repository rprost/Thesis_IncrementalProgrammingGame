import type {
  AllowedCommand,
  ExecutionStep,
  LockedConstruct,
  ParsedProgram,
  ProgramCallNode,
  ProgramNode,
  ProgramValidation,
  ValidationIssue,
} from '../types'

export const INITIAL_PROGRAM_SOURCE = 'add_score()'
export const MAX_FOR_RANGE = 8
export const MAX_STEPS_PER_RUN = 20

type ParsedLine = {
  raw: string
  trimmed: string
  lineNumber: number
  indent: number
}

function detectLockedConstruct(line: string): LockedConstruct | null {
  if (line.startsWith('for ')) {
    return 'for'
  }

  if (/^[A-Za-z_]\w*\s*=/.test(line)) {
    return 'variables'
  }

  if (line.startsWith('if ')) {
    return 'if'
  }

  if (line.startsWith('while ')) {
    return 'while'
  }

  if (line.startsWith('def ')) {
    return 'functions'
  }

  if (line.includes('[') || line.includes('append(')) {
    return 'lists'
  }

  return null
}

function parseCallNode(
  line: ParsedLine,
  allowedCommands: AllowedCommand[],
): ProgramCallNode | null {
  if (line.trimmed === 'add_score()' && allowedCommands.includes('add_score')) {
    return {
      type: 'call',
      command: 'add_score',
      lineNumber: line.lineNumber,
    }
  }

  return null
}

function expandNodes(nodes: ProgramNode[]): ExecutionStep[] {
  const steps: ExecutionStep[] = []

  for (const node of nodes) {
    if (node.type === 'call') {
      steps.push({
        type: node.command,
        lineNumber: node.lineNumber,
      })
      continue
    }

    for (let iteration = 0; iteration < node.iterations; iteration += 1) {
      for (const bodyNode of node.body) {
        steps.push({
          type: bodyNode.command,
          lineNumber: bodyNode.lineNumber,
        })
      }
    }
  }

  return steps
}

export function parseProgram(
  source: string,
  lineCapacity: number,
  allowedCommands: AllowedCommand[],
  unlockedConstructs: LockedConstruct[],
): ParsedProgram {
  const rawLines = source.replace(/\r\n/g, '\n').split('\n')
  const nonEmptyLineCount = rawLines.filter((line) => line.trim() !== '').length
  const issues: ValidationIssue[] = []

  if (nonEmptyLineCount === 0) {
    issues.push({ code: 'empty_program' })
  }

  if (nonEmptyLineCount > lineCapacity) {
    issues.push({
      code: 'line_capacity_exceeded',
      limit: lineCapacity,
    })
  }

  const parsedLines: ParsedLine[] = rawLines.map((raw, index) => ({
    raw,
    trimmed: raw.trim(),
    lineNumber: index + 1,
    indent: raw.length - raw.trimStart().length,
  }))

  const nodes: ProgramNode[] = []

  let index = 0

  while (index < parsedLines.length) {
    const line = parsedLines[index]

    if (line === undefined) {
      break
    }

    if (line.trimmed === '') {
      index += 1
      continue
    }

    if (line.indent > 0) {
      issues.push({
        code: 'unexpected_indentation',
        lineNumber: line.lineNumber,
      })
      index += 1
      continue
    }

    const directCall = parseCallNode(line, allowedCommands)

    if (directCall !== null) {
      nodes.push(directCall)
      index += 1
      continue
    }

    if (line.trimmed.startsWith('for ')) {
      if (!unlockedConstructs.includes('for')) {
        issues.push({
          code: 'locked_construct',
          lineNumber: line.lineNumber,
          construct: 'for',
        })
        index += 1
        continue
      }

      const forMatch = line.trimmed.match(/^for _ in range\((\d+)\):$/)

      if (forMatch === null) {
        issues.push({
          code: 'unsupported_for_loop',
          lineNumber: line.lineNumber,
        })
        index += 1
        continue
      }

      const iterations = Number(forMatch[1])

      if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_FOR_RANGE) {
        issues.push({
          code: 'for_range_limit',
          lineNumber: line.lineNumber,
          maxRange: MAX_FOR_RANGE,
        })
        index += 1
        continue
      }

      const body: ProgramCallNode[] = []
      let sawBody = false
      index += 1

      while (index < parsedLines.length) {
        const bodyLine = parsedLines[index]

        if (bodyLine === undefined) {
          break
        }

        if (bodyLine.trimmed === '') {
          issues.push({
            code: 'invalid_for_body',
            lineNumber: bodyLine.lineNumber,
          })
          index += 1
          continue
        }

        if (bodyLine.indent === 0) {
          break
        }

        sawBody = true

        if (
          bodyLine.trimmed.startsWith('for ') ||
          bodyLine.trimmed.startsWith('if ') ||
          bodyLine.trimmed.startsWith('while ') ||
          bodyLine.trimmed.startsWith('def ')
        ) {
          issues.push({
            code: 'nested_block_not_supported',
            lineNumber: bodyLine.lineNumber,
          })
          index += 1
          continue
        }

        const bodyCall = parseCallNode(bodyLine, allowedCommands)

        if (bodyCall === null) {
          issues.push({
            code: 'invalid_for_body',
            lineNumber: bodyLine.lineNumber,
          })
          index += 1
          continue
        }

        body.push(bodyCall)
        index += 1
      }

      if (!sawBody || body.length === 0) {
        issues.push({
          code: 'for_body_required',
          lineNumber: line.lineNumber,
        })
        continue
      }

      nodes.push({
        type: 'for_range',
        lineNumber: line.lineNumber,
        iterations,
        body,
      })
      continue
    }

    const lockedConstruct = detectLockedConstruct(line.trimmed)

    if (lockedConstruct !== null) {
      issues.push({
        code: 'locked_construct',
        lineNumber: line.lineNumber,
        construct: lockedConstruct,
      })
      index += 1
      continue
    }

    issues.push({
      code: 'invalid_command',
      lineNumber: line.lineNumber,
    })
    index += 1
  }

  const steps = issues.length === 0 ? expandNodes(nodes) : []

  if (steps.length > MAX_STEPS_PER_RUN) {
    issues.push({
      code: 'step_limit_exceeded',
      maxSteps: MAX_STEPS_PER_RUN,
    })
  }

  const validation: ProgramValidation = {
    isValid: issues.length === 0,
    issues,
    executableLineCount: nonEmptyLineCount,
    executionStepCount:
      issues.some((issue) => issue.code === 'step_limit_exceeded') || issues.length > 0
        ? 0
        : steps.length,
  }

  return {
    nodes,
    steps: validation.isValid ? steps : [],
    validation,
  }
}
