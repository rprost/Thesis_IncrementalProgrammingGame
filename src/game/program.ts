import type {
  ActiveBallSource,
  AimLevel,
  AllowedCommand,
  BallType,
  ExecutionStep,
  LockedConstruct,
  ParsedProgram,
  ProgramFeatureUsage,
  ProgramValidation,
  ValidationIssue,
} from '../types'

export const INITIAL_PROGRAM_SOURCE = 'drop_ball()'
export const INITIAL_HELPER_SOURCE = [
  'def follow_portal():',
  '    choose_input(portal_side)',
  '    drop_ball()',
].join('\n')
export const MAX_FOR_RANGE = 8
export const MAX_STEPS_PER_RUN = 20
export const MAX_HELPER_FUNCTIONS = 1
export const BASE_HELPER_LINE_LIMIT = 6

type ParsedLine = {
  raw: string
  trimmed: string
  lineNumber: number
  indent: number
}

type ExprNode =
  | { type: 'number'; value: number }
  | { type: 'identifier'; name: string }
  | { type: 'binary'; operator: '+' | '-' | '*'; left: ExprNode; right: ExprNode }
  | { type: 'unary'; operator: '-'; value: ExprNode }

type ConditionNode = {
  left: ExprNode
  operator: '==' | '!=' | '<' | '<=' | '>' | '>='
  right: ExprNode
}

type StatementNode =
  | { type: 'drop_ball'; lineNumber: number }
  | { type: 'skip_ball'; lineNumber: number }
  | { type: 'continue'; lineNumber: number }
  | { type: 'choose_input'; lineNumber: number; value: ExprNode }
  | { type: 'assign'; lineNumber: number; name: string; value: ExprNode }
  | {
      type: 'if'
      lineNumber: number
      condition: ConditionNode
      thenBody: StatementNode[]
      elseBody: StatementNode[]
    }
  | {
      type: 'for_range'
      lineNumber: number
      iterations: number
      loopVariable: string
      body: StatementNode[]
    }
  | { type: 'helper_call'; lineNumber: number; name: string }

type HelperDefinition = {
  name: string
  lineNumber: number
  body: StatementNode[]
}

type ParseContext = {
  allowedCommands: AllowedCommand[]
  unlockedConstructs: LockedConstruct[]
  allowHelperCalls: boolean
  helperNames: Set<string>
  allowFunctionDefinitions: boolean
  insideLoop: boolean
}

type Token =
  | { type: 'number'; value: number }
  | { type: 'identifier'; value: string }
  | { type: 'operator'; value: '+' | '-' | '*' | '(' | ')' }

type EvaluationContext = Record<string, number>
type PlanningContext = {
  ballQueue: BallType[]
  queueIndex: number
}
type ExecutionControl = 'none' | 'continue'

function createFeatureUsage(): ProgramFeatureUsage {
  return {
    usedVariables: false,
    usedChooseInput: false,
    usedIf: false,
    usedHelperCall: false,
    usedFor: false,
    usedContinue: false,
  }
}

function createValidation(
  issues: ValidationIssue[],
  executableLineCount: number,
  executionStepCount: number,
  helperCount = 0,
): ProgramValidation {
  const hasIssues = issues.length > 0

  return {
    isValid: !hasIssues,
    issues,
    executableLineCount,
    executionStepCount: hasIssues ? 0 : executionStepCount,
    helperCount,
  }
}

function getBallTypeValue(ballType: BallType): number {
  switch (ballType) {
    case 'portal':
      return 2
    case 'negative':
      return 3
    case 'plain':
      return 0
    case 'center':
    default:
      return 1
  }
}

function peekBallType(planning: PlanningContext): BallType {
  return planning.ballQueue[planning.queueIndex] ?? 'plain'
}

function syncNextBall(environment: EvaluationContext, planning: PlanningContext): void {
  environment.next_ball = getBallTypeValue(peekBallType(planning))
}

function consumeNextBall(
  environment: EvaluationContext,
  planning: PlanningContext,
): BallType {
  const current = peekBallType(planning)
  planning.queueIndex += 1
  syncNextBall(environment, planning)
  return current
}

function tokenizeExpression(source: string): Token[] | null {
  const tokens: Token[] = []
  let index = 0

  while (index < source.length) {
    const current = source[index]

    if (current === undefined) {
      break
    }

    if (/\s/.test(current)) {
      index += 1
      continue
    }

    if (/\d/.test(current)) {
      let end = index + 1

      while (end < source.length && /\d/.test(source[end] ?? '')) {
        end += 1
      }

      tokens.push({
        type: 'number',
        value: Number(source.slice(index, end)),
      })
      index = end
      continue
    }

    if (/[A-Za-z_]/.test(current)) {
      let end = index + 1

      while (end < source.length && /[A-Za-z0-9_]/.test(source[end] ?? '')) {
        end += 1
      }

      tokens.push({
        type: 'identifier',
        value: source.slice(index, end),
      })
      index = end
      continue
    }

    if (
      current === '+' ||
      current === '-' ||
      current === '*' ||
      current === '(' ||
      current === ')'
    ) {
      tokens.push({
        type: 'operator',
        value: current,
      })
      index += 1
      continue
    }

    return null
  }

  return tokens
}

function parseExpression(source: string): ExprNode | null {
  const tokens = tokenizeExpression(source)

  if (tokens === null || tokens.length === 0) {
    return null
  }

  const expressionTokens = tokens
  let index = 0

  function parseBasePrimary(): ExprNode | null {
    const token = expressionTokens[index]

    if (token === undefined) {
      return null
    }

    if (token.type === 'number') {
      index += 1
      return {
        type: 'number',
        value: token.value,
      }
    }

    if (token.type === 'identifier') {
      index += 1
      return {
        type: 'identifier',
        name: token.value,
      }
    }

    if (token.type === 'operator' && token.value === '(') {
      index += 1
      const inner = parseAdditive()

      if (
        inner === null ||
        expressionTokens[index]?.type !== 'operator' ||
        expressionTokens[index]?.value !== ')'
      ) {
        return null
      }

      index += 1
      return inner
    }

    return null
  }

  function parsePrimary(): ExprNode | null {
    const token = expressionTokens[index]

    if (
      token?.type === 'operator' &&
      token.value === '-'
    ) {
      index += 1
      const inner = parsePrimary()

      if (inner === null) {
        return null
      }

      return {
        type: 'unary',
        operator: '-',
        value: inner,
      }
    }

    const base = parseBasePrimary()

    if (base === null) {
      return null
    }

    return base
  }

  function parseMultiplicative(): ExprNode | null {
    let left = parsePrimary()

    while (
      expressionTokens[index]?.type === 'operator' &&
      expressionTokens[index]?.value === '*'
    ) {
      index += 1
      const right = parsePrimary()

      if (left === null || right === null) {
        return null
      }

      left = {
        type: 'binary',
        operator: '*',
        left,
        right,
      }
    }

    return left
  }

  function parseAdditive(): ExprNode | null {
    let left = parseMultiplicative()

    while (
      expressionTokens[index]?.type === 'operator' &&
      (expressionTokens[index]?.value === '+' ||
        expressionTokens[index]?.value === '-')
    ) {
      const operator = expressionTokens[index]?.value
      index += 1
      const right = parseMultiplicative()

      if (
        left === null ||
        right === null ||
        (operator !== '+' && operator !== '-')
      ) {
        return null
      }

      left = {
        type: 'binary',
        operator,
        left,
        right,
      }
    }

    return left
  }

  const result = parseAdditive()

  if (result === null || index !== expressionTokens.length) {
    return null
  }

  return result
}

function parseCondition(source: string): ConditionNode | null {
  const match = source.match(/^(.*?)(==|!=|<=|>=|<|>)(.*)$/)

  if (match === null) {
    return null
  }

  const left = parseExpression(match[1]?.trim() ?? '')
  const operator = match[2]
  const right = parseExpression(match[3]?.trim() ?? '')

  if (
    left === null ||
    right === null ||
    (operator !== '==' &&
      operator !== '!=' &&
      operator !== '<' &&
      operator !== '<=' &&
      operator !== '>' &&
      operator !== '>=')
  ) {
    return null
  }

  return {
    left,
    operator,
    right,
  }
}

function evaluateExpression(
  node: ExprNode,
  environment: EvaluationContext,
): number {
  switch (node.type) {
    case 'number':
      return node.value
    case 'identifier': {
      const value = environment[node.name]

      if (value === undefined) {
        throw new Error(`Unknown identifier: ${node.name}`)
      }

      return value
    }
    case 'unary':
      return -evaluateNumericExpression(node.value, environment)
    case 'binary': {
      const left = evaluateNumericExpression(node.left, environment)
      const right = evaluateNumericExpression(node.right, environment)

      switch (node.operator) {
        case '+':
          return left + right
        case '-':
          return left - right
        case '*':
          return left * right
        default:
          return left
      }
    }
    default:
      return 0
  }
}

function evaluateNumericExpression(
  node: ExprNode,
  environment: EvaluationContext,
): number {
  return evaluateExpression(node, environment)
}

function evaluateCondition(
  node: ConditionNode,
  environment: EvaluationContext,
): boolean {
  const left = evaluateNumericExpression(node.left, environment)
  const right = evaluateNumericExpression(node.right, environment)

  switch (node.operator) {
    case '==':
      return left === right
    case '!=':
      return left !== right
    case '<':
      return left < right
    case '<=':
      return left <= right
    case '>':
      return left > right
    case '>=':
      return left >= right
    default:
      return false
  }
}

function detectLockedConstruct(line: string): LockedConstruct | null {
  if (line.startsWith('for ')) {
    return 'for'
  }

  if (line === 'continue') {
    return 'for'
  }

  if (/^[A-Za-z_]\w*\s*=/.test(line)) {
    return 'variables'
  }

  if (line.startsWith('if ') || line.startsWith('else:')) {
    return 'if'
  }

  if (line.startsWith('def ')) {
    return 'functions'
  }

  return null
}

function parseLines(source: string): ParsedLine[] {
  return source.replace(/\r\n/g, '\n').split('\n').map((raw, index) => ({
    raw,
    trimmed: raw.trim(),
    lineNumber: index + 1,
    indent: raw.length - raw.trimStart().length,
  }))
}

function countNonEmptyLines(lines: ParsedLine[]): number {
  return lines.filter((line) => line.trimmed !== '').length
}

function parseIndentedBlock(
  lines: ParsedLine[],
  startIndex: number,
  parentIndent: number,
  context: ParseContext,
  missingBodyCode: ValidationIssue['code'],
): { statements: StatementNode[]; nextIndex: number; issues: ValidationIssue[] } {
  let nextIndex = startIndex

  while (nextIndex < lines.length && lines[nextIndex]?.trimmed === '') {
    nextIndex += 1
  }

  const firstLine = lines[nextIndex]

  if (firstLine === undefined || firstLine.indent <= parentIndent) {
    return {
      statements: [],
      nextIndex,
      issues: [
        {
          code: missingBodyCode,
          lineNumber: lines[startIndex - 1]?.lineNumber ?? firstLine?.lineNumber,
        },
      ],
    }
  }

  return parseStatements(lines, nextIndex, firstLine.indent, context)
}

function parseStatements(
  lines: ParsedLine[],
  startIndex: number,
  currentIndent: number,
  context: ParseContext,
): { statements: StatementNode[]; nextIndex: number; issues: ValidationIssue[] } {
  const statements: StatementNode[] = []
  const issues: ValidationIssue[] = []
  let index = startIndex

  while (index < lines.length) {
    const line = lines[index]

    if (line === undefined) {
      break
    }

    if (line.trimmed === '') {
      index += 1
      continue
    }

    if (line.indent < currentIndent) {
      break
    }

    if (line.indent > currentIndent) {
      issues.push({
        code: 'unexpected_indentation',
        lineNumber: line.lineNumber,
      })
      index += 1
      continue
    }

    if (line.trimmed === 'else:') {
      break
    }

    if (line.trimmed.startsWith('def ')) {
      issues.push({
        code: context.allowFunctionDefinitions
          ? 'invalid_function_definition'
          : 'locked_construct',
        lineNumber: line.lineNumber,
        construct: 'functions',
      })
      index += 1
      continue
    }

    if (line.trimmed.startsWith('if ')) {
      if (!context.unlockedConstructs.includes('if')) {
        issues.push({
          code: 'locked_construct',
          lineNumber: line.lineNumber,
          construct: 'if',
        })
        index += 1
        continue
      }

      const ifMatch = line.trimmed.match(/^if (.+):$/)
      const condition = parseCondition(ifMatch?.[1]?.trim() ?? '')

      if (condition === null) {
        issues.push({
          code: 'invalid_condition',
          lineNumber: line.lineNumber,
        })
        index += 1
        continue
      }

      const thenBlock = parseIndentedBlock(
        lines,
        index + 1,
        currentIndent,
        context,
        'for_body_required',
      )
      issues.push(...thenBlock.issues)
      index = thenBlock.nextIndex

      let elseBody: StatementNode[] = []
      const maybeElseLine = lines[index]

      if (
        maybeElseLine !== undefined &&
        maybeElseLine.trimmed === 'else:' &&
        maybeElseLine.indent === currentIndent
      ) {
        const elseBlock = parseIndentedBlock(
          lines,
          index + 1,
          currentIndent,
          context,
          'for_body_required',
        )
        issues.push(...elseBlock.issues)
        elseBody = elseBlock.statements
        index = elseBlock.nextIndex
      }

      statements.push({
        type: 'if',
        lineNumber: line.lineNumber,
        condition,
        thenBody: thenBlock.statements,
        elseBody,
      })
      continue
    }

    if (line.trimmed.startsWith('for ')) {
      if (!context.unlockedConstructs.includes('for')) {
        issues.push({
          code: 'locked_construct',
          lineNumber: line.lineNumber,
          construct: 'for',
        })
        index += 1
        continue
      }

      const forMatch = line.trimmed.match(/^for ([A-Za-z_]\w*) in range\((\d+)\):$/)

      if (forMatch === null) {
        issues.push({
          code: 'unsupported_for_loop',
          lineNumber: line.lineNumber,
        })
        index += 1
        continue
      }

      const loopVariable = forMatch[1] ?? '_'
      const iterations = Number(forMatch[2])

      if (
        !Number.isInteger(iterations) ||
        iterations < 1 ||
        iterations > MAX_FOR_RANGE
      ) {
        issues.push({
          code: 'for_range_limit',
          lineNumber: line.lineNumber,
          maxRange: MAX_FOR_RANGE,
        })
        index += 1
        continue
      }

      const block = parseIndentedBlock(
        lines,
        index + 1,
        currentIndent,
        {
          ...context,
          insideLoop: true,
        },
        'for_body_required',
      )
      issues.push(...block.issues)

      if (block.statements.length === 0) {
        issues.push({
          code: 'for_body_required',
          lineNumber: line.lineNumber,
        })
      }

      statements.push({
        type: 'for_range',
        lineNumber: line.lineNumber,
        iterations,
        loopVariable,
        body: block.statements,
      })
      index = block.nextIndex
      continue
    }

    if (line.trimmed === 'continue') {
      if (!context.unlockedConstructs.includes('for')) {
        issues.push({
          code: 'locked_construct',
          lineNumber: line.lineNumber,
          construct: 'for',
        })
      } else if (!context.insideLoop) {
        issues.push({
          code: 'continue_outside_loop',
          lineNumber: line.lineNumber,
        })
      } else {
        statements.push({
          type: 'continue',
          lineNumber: line.lineNumber,
        })
      }
      index += 1
      continue
    }

    const assignmentMatch = line.trimmed.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/)

    if (assignmentMatch !== null) {
      if (!context.unlockedConstructs.includes('variables')) {
        issues.push({
          code: 'locked_construct',
          lineNumber: line.lineNumber,
          construct: 'variables',
        })
        index += 1
        continue
      }

      const expression = parseExpression(assignmentMatch[2]?.trim() ?? '')

      if (expression === null) {
        issues.push({
          code: 'invalid_expression',
          lineNumber: line.lineNumber,
        })
        index += 1
        continue
      }

      statements.push({
        type: 'assign',
        lineNumber: line.lineNumber,
        name: assignmentMatch[1] ?? 'value',
        value: expression,
      })
      index += 1
      continue
    }

    const callMatch = line.trimmed.match(/^([A-Za-z_]\w*)\((.*)\)$/)

    if (callMatch !== null) {
      const name = callMatch[1] ?? ''
      const args = callMatch[2]?.trim() ?? ''

      if (name === 'drop_ball') {
        if (args !== '' || !context.allowedCommands.includes('drop_ball')) {
          issues.push({
            code: 'invalid_command',
            lineNumber: line.lineNumber,
          })
        } else {
          statements.push({
            type: 'drop_ball',
            lineNumber: line.lineNumber,
          })
        }
        index += 1
        continue
      }

      if (name === 'skip_ball') {
        if (args !== '' || !context.allowedCommands.includes('skip_ball')) {
          issues.push({
            code: context.allowedCommands.includes('skip_ball')
              ? 'invalid_command'
              : 'locked_construct',
            lineNumber: line.lineNumber,
            construct: 'if',
          })
        } else {
          statements.push({
            type: 'skip_ball',
            lineNumber: line.lineNumber,
          })
        }
        index += 1
        continue
      }

      if (name === 'choose_input') {
        if (!context.allowedCommands.includes('choose_input')) {
          issues.push({
            code: 'locked_construct',
            lineNumber: line.lineNumber,
            construct: 'variables',
          })
          index += 1
          continue
        }

        const expression = parseExpression(args)

        if (expression === null) {
          issues.push({
            code: 'invalid_set_aim',
            lineNumber: line.lineNumber,
          })
          index += 1
          continue
        }

        statements.push({
          type: 'choose_input',
          lineNumber: line.lineNumber,
          value: expression,
        })
        index += 1
        continue
      }

      if (context.allowHelperCalls) {
        if (!context.helperNames.has(name)) {
          issues.push({
            code: 'helper_not_defined',
            lineNumber: line.lineNumber,
            helperName: name,
          })
          index += 1
          continue
        }

        if (args !== '') {
          issues.push({
            code: 'invalid_command',
            lineNumber: line.lineNumber,
          })
          index += 1
          continue
        }

        statements.push({
          type: 'helper_call',
          lineNumber: line.lineNumber,
          name,
        })
        index += 1
        continue
      }
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

  return {
    statements,
    nextIndex: index,
    issues,
  }
}

function parseHelperProgram(
  source: string,
  helperLineLimit: number,
  allowedCommands: AllowedCommand[],
  unlockedConstructs: LockedConstruct[],
): {
  definitions: Map<string, HelperDefinition>
  validation: ProgramValidation
} {
  const lines = parseLines(source)
  const issues: ValidationIssue[] = []
  const helperDefinitions = new Map<string, HelperDefinition>()
  const nonEmptyLineCount = countNonEmptyLines(lines)

  if (source.trim() === '') {
    return {
      definitions: helperDefinitions,
      validation: createValidation([], 0, 0, 0),
    }
  }

  if (!unlockedConstructs.includes('functions')) {
    return {
      definitions: helperDefinitions,
      validation: createValidation(
        [
          {
            code: 'locked_construct',
            lineNumber: 1,
            construct: 'functions',
          },
        ],
        nonEmptyLineCount,
        0,
        0,
      ),
    }
  }

  if (nonEmptyLineCount > helperLineLimit) {
    issues.push({
      code: 'helper_line_limit_exceeded',
      lineNumber: 1,
      limit: helperLineLimit,
    })
  }

  let index = 0

  while (index < lines.length) {
    const line = lines[index]

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

    const defMatch = line.trimmed.match(/^def ([A-Za-z_]\w*)\(\):$/)

    if (defMatch === null) {
      issues.push({
        code: 'invalid_function_definition',
        lineNumber: line.lineNumber,
      })
      index += 1
      continue
    }

    const helperName = defMatch[1] ?? ''

    if (
      helperName === 'drop_ball' ||
      helperName === 'skip_ball' ||
      helperName === 'choose_input'
    ) {
      issues.push({
        code: 'duplicate_function',
        lineNumber: line.lineNumber,
        helperName,
      })
      index += 1
      continue
    }

    if (helperDefinitions.has(helperName)) {
      issues.push({
        code: 'duplicate_function',
        lineNumber: line.lineNumber,
        helperName,
      })
      index += 1
      continue
    }

    if (helperDefinitions.size >= MAX_HELPER_FUNCTIONS) {
      issues.push({
        code: 'helper_limit_exceeded',
        lineNumber: line.lineNumber,
        limit: MAX_HELPER_FUNCTIONS,
      })
      index += 1
      continue
    }

    const block = parseIndentedBlock(
      lines,
      index + 1,
      0,
      {
        allowedCommands,
        unlockedConstructs,
        allowHelperCalls: false,
        helperNames: new Set<string>(),
        allowFunctionDefinitions: false,
        insideLoop: false,
      },
      'for_body_required',
    )
    issues.push(...block.issues)

    helperDefinitions.set(helperName, {
      name: helperName,
      lineNumber: line.lineNumber,
      body: block.statements,
    })
    index = block.nextIndex
  }

  return {
    definitions: helperDefinitions,
    validation: createValidation(
      issues,
      nonEmptyLineCount,
      0,
      helperDefinitions.size,
    ),
  }
}

function executeStatements(
  statements: StatementNode[],
  environment: EvaluationContext,
  helperDefinitions: Map<string, HelperDefinition>,
  steps: ExecutionStep[],
  issues: ValidationIssue[],
  featureUsage: ProgramFeatureUsage,
  planning: PlanningContext,
  callStack: string[] = [],
): ExecutionControl {
  for (const statement of statements) {
    if (steps.length >= MAX_STEPS_PER_RUN) {
      issues.push({
        code: 'step_limit_exceeded',
        maxSteps: MAX_STEPS_PER_RUN,
      })
      return 'none'
    }

    try {
      switch (statement.type) {
        case 'drop_ball':
          {
            const source: ActiveBallSource =
              callStack.length > 0 ? 'helper' : 'main'
            const ballType = consumeNextBall(environment, planning)

            steps.push({
              type: 'drop_ball',
              lineNumber: statement.lineNumber,
              aim: environment.__aim as AimLevel,
              source,
              ballType,
            })
          }
          break
        case 'skip_ball': {
          const ballType = consumeNextBall(environment, planning)

          steps.push({
            type: 'skip_ball',
            lineNumber: statement.lineNumber,
            ballType,
          })
          break
        }
        case 'continue':
          featureUsage.usedContinue = true
          return 'continue'
        case 'choose_input': {
          featureUsage.usedChooseInput = true
          const value = evaluateNumericExpression(statement.value, environment)

          if (value < 1 || value > 3) {
            issues.push({
              code: 'aim_range_limit',
              lineNumber: statement.lineNumber,
            })
            return 'none'
          }

          environment.__aim = value
          break
        }
        case 'assign':
          featureUsage.usedVariables = true
          environment[statement.name] = evaluateExpression(statement.value, environment)
          break
        case 'if':
          featureUsage.usedIf = true
          {
            const control = executeStatements(
              evaluateCondition(statement.condition, environment)
                ? statement.thenBody
                : statement.elseBody,
              environment,
              helperDefinitions,
              steps,
              issues,
              featureUsage,
              planning,
              callStack,
            )

            if (issues.length > 0) {
              return 'none'
            }

            if (control === 'continue') {
              return 'continue'
            }
          }
          break
        case 'for_range':
          featureUsage.usedFor = true
          for (let iteration = 0; iteration < statement.iterations; iteration += 1) {
            environment[statement.loopVariable] = iteration
            const control = executeStatements(
              statement.body,
              environment,
              helperDefinitions,
              steps,
              issues,
              featureUsage,
              planning,
              callStack,
            )

            if (issues.length > 0) {
              return 'none'
            }

            if (control === 'continue') {
              continue
            }
          }
          break
        case 'helper_call': {
          featureUsage.usedHelperCall = true
          const helper = helperDefinitions.get(statement.name)

          if (helper === undefined) {
            issues.push({
              code: 'helper_not_defined',
              lineNumber: statement.lineNumber,
              helperName: statement.name,
            })
            return 'none'
          }

          if (callStack.includes(statement.name)) {
            issues.push({
              code: 'invalid_command',
              lineNumber: statement.lineNumber,
            })
            return 'none'
          }

          {
            const control = executeStatements(
              helper.body,
              environment,
              helperDefinitions,
              steps,
              issues,
              featureUsage,
              planning,
              [...callStack, statement.name],
            )

            if (issues.length > 0) {
              return 'none'
            }

            if (control === 'continue') {
              return 'continue'
            }
          }
          break
        }
        default:
          break
      }
    } catch {
      issues.push({
        code:
          statement.type === 'if'
            ? 'invalid_condition'
            : statement.type === 'choose_input' || statement.type === 'assign'
              ? 'invalid_expression'
              : 'invalid_command',
        lineNumber: statement.lineNumber,
      })
      return 'none'
    }
  }

  return 'none'
}

export function parseProgram(
  source: string,
  helperSource: string,
  lineCapacity: number,
  helperLineLimit: number,
  allowedCommands: AllowedCommand[],
  unlockedConstructs: LockedConstruct[],
  evaluationContext: EvaluationContext,
  ballQueue: BallType[],
): ParsedProgram {
  const mainLines = parseLines(source)
  const nonEmptyLineCount = countNonEmptyLines(mainLines)
  const mainIssues: ValidationIssue[] = []

  if (nonEmptyLineCount === 0) {
    mainIssues.push({ code: 'empty_program' })
  }

  if (nonEmptyLineCount > lineCapacity) {
    mainIssues.push({
      code: 'line_capacity_exceeded',
      limit: lineCapacity,
    })
  }

  const helperResult = parseHelperProgram(
    helperSource,
    helperLineLimit,
    allowedCommands,
    unlockedConstructs,
  )
  const helperNames = new Set(helperResult.definitions.keys())

  const mainStatements = parseStatements(
    mainLines,
    0,
    0,
    {
      allowedCommands,
      unlockedConstructs,
      allowHelperCalls: unlockedConstructs.includes('functions'),
      helperNames,
      allowFunctionDefinitions: false,
      insideLoop: false,
    },
  )

  mainIssues.push(...mainStatements.issues)

  const environment: EvaluationContext = {
    __aim: 2,
    ...evaluationContext,
  }
  const planning: PlanningContext = {
    ballQueue,
    queueIndex: 0,
  }
  syncNextBall(environment, planning)
  const steps: ExecutionStep[] = []
  const evaluationIssues: ValidationIssue[] = []
  const featureUsage = createFeatureUsage()

  if (mainIssues.length === 0 && helperResult.validation.isValid) {
    executeStatements(
      mainStatements.statements,
      environment,
      helperResult.definitions,
      steps,
      evaluationIssues,
      featureUsage,
      planning,
    )
  }

  if (steps.length > MAX_STEPS_PER_RUN) {
    evaluationIssues.push({
      code: 'step_limit_exceeded',
      maxSteps: MAX_STEPS_PER_RUN,
    })
  }

  const combinedMainIssues = [...mainIssues, ...evaluationIssues]
  const launchStepCount = steps.filter((step) => step.type === 'drop_ball').length

  return {
    steps: combinedMainIssues.length === 0 ? steps : [],
    featureUsage,
    mainValidation: createValidation(
      combinedMainIssues,
      nonEmptyLineCount,
      launchStepCount,
      helperResult.validation.helperCount,
    ),
    helperValidation: helperResult.validation,
  }
}
