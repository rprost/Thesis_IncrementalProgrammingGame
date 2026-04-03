import { startTransition, useEffect, useState } from 'react'
import './App.css'
import { ActivityFeed } from './components/ActivityFeed'
import { AvailableSyntaxCard } from './components/AvailableSyntaxCard'
import { PachinkoBoard } from './components/PachinkoBoard'
import { ProgramEditor } from './components/ProgramEditor'
import { ShopTree } from './components/ShopTree'
import { TaskModal } from './components/TaskModal'
import { TutorialSpotlight } from './components/TutorialSpotlight'
import {
  formatText,
  getInitialLocale,
  getLocaleContent,
  LANGUAGE_STORAGE_KEY,
} from './content'
import {
  advanceProgramRun,
  applyTaskResult,
  createInitialGameState,
  dismissTutorialStep,
  getRunsUntilChallenge,
  purchaseShopNode,
  setCurrentView,
  startProgramRun,
  updateHelperProgramSource,
  updateProgramSource,
} from './game/engine'
import { MAX_FOR_RANGE, MAX_HELPER_LINES, MAX_STEPS_PER_RUN } from './game/program'
import { canOpenShop } from './game/shop'
import type {
  GameTask,
  Locale,
  LockedConstruct,
  ProgramValidation,
  ShopNodeId,
  TutorialStep,
  UiText,
} from './types'

function getConstructLabel(construct: LockedConstruct, ui: UiText): string {
  switch (construct) {
    case 'for':
      return ui.constructForLabel
    case 'variables':
      return ui.constructVariablesLabel
    case 'if':
      return ui.constructIfLabel
    case 'while':
      return ui.constructWhileLabel
    case 'functions':
      return ui.constructFunctionsLabel
    case 'lists':
      return ui.constructListsLabel
    default:
      return ui.constructFunctionsLabel
  }
}

function getProgramValidationMessage(
  validation: ProgramValidation,
  ui: UiText,
): string | null {
  if (validation.isValid) {
    return null
  }

  const prioritizedIssue =
    validation.issues.find((issue) => issue.code === 'step_limit_exceeded') ??
    validation.issues.find((issue) => issue.code === 'helper_limit_exceeded') ??
    validation.issues.find((issue) => issue.code === 'duplicate_function') ??
    validation.issues.find((issue) => issue.code === 'helper_not_defined') ??
    validation.issues.find((issue) => issue.code === 'invalid_function_definition') ??
    validation.issues.find((issue) => issue.code === 'aim_range_limit') ??
    validation.issues.find((issue) => issue.code === 'invalid_set_aim') ??
    validation.issues.find((issue) => issue.code === 'invalid_condition') ??
    validation.issues.find((issue) => issue.code === 'invalid_expression') ??
    validation.issues.find((issue) => issue.code === 'locked_construct') ??
    validation.issues.find((issue) => issue.code === 'for_range_limit') ??
    validation.issues.find((issue) => issue.code === 'unsupported_for_loop') ??
    validation.issues.find((issue) => issue.code === 'for_body_required') ??
    validation.issues.find((issue) => issue.code === 'nested_block_not_supported') ??
    validation.issues.find((issue) => issue.code === 'invalid_for_body') ??
    validation.issues.find((issue) => issue.code === 'unexpected_indentation') ??
    validation.issues.find((issue) => issue.code === 'invalid_command') ??
    validation.issues.find((issue) => issue.code === 'line_capacity_exceeded') ??
    validation.issues[0]

  switch (prioritizedIssue.code) {
    case 'empty_program':
      return ui.programErrorEmpty
    case 'line_capacity_exceeded':
      return formatText(ui.programErrorTooManyLines, {
        limit: String(prioritizedIssue.limit ?? 0),
      })
    case 'invalid_command':
      return formatText(ui.programErrorInvalidLine, {
        line: String(prioritizedIssue.lineNumber ?? 1),
      })
    case 'locked_construct':
      return formatText(ui.programErrorLockedConstruct, {
        construct: getConstructLabel(
          prioritizedIssue.construct ?? 'functions',
          ui,
        ),
      })
    case 'unsupported_for_loop':
      return formatText(ui.programErrorUnsupportedForLoop, {
        line: String(prioritizedIssue.lineNumber ?? 1),
      })
    case 'for_range_limit':
      return formatText(ui.programErrorForRangeLimit, {
        line: String(prioritizedIssue.lineNumber ?? 1),
        max: String(prioritizedIssue.maxRange ?? MAX_FOR_RANGE),
      })
    case 'for_body_required':
      return formatText(ui.programErrorForBodyRequired, {
        line: String(prioritizedIssue.lineNumber ?? 1),
      })
    case 'invalid_for_body':
      return formatText(ui.programErrorInvalidForBody, {
        line: String(prioritizedIssue.lineNumber ?? 1),
      })
    case 'nested_block_not_supported':
      return formatText(ui.programErrorNestedBlocks, {
        line: String(prioritizedIssue.lineNumber ?? 1),
      })
    case 'unexpected_indentation':
      return formatText(ui.programErrorUnexpectedIndentation, {
        line: String(prioritizedIssue.lineNumber ?? 1),
      })
    case 'step_limit_exceeded':
      return formatText(ui.programErrorStepLimitExceeded, {
        max: String(prioritizedIssue.maxSteps ?? MAX_STEPS_PER_RUN),
      })
    case 'invalid_expression':
      return formatText(ui.programErrorInvalidExpression, {
        line: String(prioritizedIssue.lineNumber ?? 1),
      })
    case 'invalid_condition':
      return formatText(ui.programErrorInvalidCondition, {
        line: String(prioritizedIssue.lineNumber ?? 1),
      })
    case 'invalid_set_aim':
      return formatText(ui.programErrorInvalidSetAim, {
        line: String(prioritizedIssue.lineNumber ?? 1),
      })
    case 'aim_range_limit':
      return formatText(ui.programErrorAimRangeLimit, {
        line: String(prioritizedIssue.lineNumber ?? 1),
      })
    case 'invalid_function_definition':
      return formatText(ui.programErrorInvalidFunctionDefinition, {
        line: String(prioritizedIssue.lineNumber ?? 1),
      })
    case 'duplicate_function':
      return formatText(ui.programErrorDuplicateFunction, {
        line: String(prioritizedIssue.lineNumber ?? 1),
        name: prioritizedIssue.helperName ?? 'helper',
      })
    case 'helper_limit_exceeded':
      return formatText(ui.programErrorHelperLimitExceeded, {
        limit: String(prioritizedIssue.limit ?? 1),
      })
    case 'helper_line_limit_exceeded':
      return formatText(ui.programErrorHelperLineLimitExceeded, {
        limit: String(prioritizedIssue.limit ?? MAX_HELPER_LINES),
      })
    case 'helper_not_defined':
      return formatText(ui.programErrorHelperNotDefined, {
        line: String(prioritizedIssue.lineNumber ?? 1),
        name: prioritizedIssue.helperName ?? 'helper',
      })
    default:
      return ui.runBlockedInvalidProgram
  }
}

function getVisibleTutorialStep(
  tutorialStep: TutorialStep,
  dismissedTutorialSteps: TutorialStep[],
  isTaskOpen: boolean,
): TutorialStep | null {
  if (
    tutorialStep === 'editor_unlock' &&
    !dismissedTutorialSteps.includes('editor_unlock')
  ) {
    return 'editor_unlock'
  }

  if (
    tutorialStep === 'first_challenge' &&
    isTaskOpen &&
    !dismissedTutorialSteps.includes('first_challenge')
  ) {
    return 'first_challenge'
  }

  if (
    tutorialStep === 'run_program' &&
    !dismissedTutorialSteps.includes('run_program')
  ) {
    return 'run_program'
  }

  return null
}

function getTutorialContent(
  tutorialStep: TutorialStep | null,
  ui: UiText,
): { title: string; message: string } | null {
  if (tutorialStep === null) {
    return null
  }

  switch (tutorialStep) {
    case 'run_program':
      return {
        title: ui.tutorialRunTitle,
        message: ui.tutorialRunMessage,
      }
    case 'first_challenge':
      return {
        title: ui.tutorialChallengeTitle,
        message: ui.tutorialChallengeMessage,
      }
    case 'editor_unlock':
      return {
        title: ui.tutorialEditorTitle,
        message: ui.tutorialEditorMessage,
      }
    default:
      return null
  }
}

function App() {
  const [locale, setLocale] = useState<Locale>(() => getInitialLocale())
  const [gameState, setGameState] = useState(() => createInitialGameState())
  const [animationNow, setAnimationNow] = useState(() => Date.now())

  const { ui, tasks, shopNodes } = getLocaleContent(locale)
  const activeTask =
    gameState.activeTaskId === null
      ? null
      : tasks.find((task) => task.id === gameState.activeTaskId) ?? null
  const shopIsAvailable = canOpenShop(gameState)
  const visibleTutorialStep = getVisibleTutorialStep(
    gameState.tutorialStep,
    gameState.dismissedTutorialSteps,
    activeTask !== null && gameState.isTaskOpen,
  )
  const tutorialContent = getTutorialContent(visibleTutorialStep, ui)
  const functionsUnlocked =
    gameState.unlocks.unlockedConstructs.includes('functions')
  const runsUntilChallenge = getRunsUntilChallenge(gameState, tasks)
  const validationMessage = getProgramValidationMessage(
    gameState.programValidation,
    ui,
  )
  const helperValidationMessage = getProgramValidationMessage(
    gameState.helperProgramValidation,
    ui,
  )
  const lineUsageText = formatText(ui.editorLineUsageValue, {
    used: String(gameState.programValidation.executableLineCount),
    limit: String(gameState.unlocks.lineCapacity),
  })
  const helperUsageText = formatText(ui.helperEditorLineUsageValue, {
    used: String(gameState.helperProgramValidation.executableLineCount),
    limit: String(MAX_HELPER_LINES),
  })
  const ballsPerRunText = formatText(ui.actionsPerRunValue, {
    count: String(gameState.programValidation.executionStepCount),
  })
  const remainingTasksForEditorUnlock = Math.max(
    0,
    2 - gameState.correctAnswerCount,
  )
  const programStatus = gameState.isRunning
    ? ui.programStatusRunning
    : !gameState.unlocks.editorEditable
      ? ui.programStatusLocked
      : gameState.programValidation.isValid &&
          (!functionsUnlocked || gameState.helperProgramValidation.isValid)
        ? ui.programStatusReady
        : ui.programStatusInvalid
  const editorHelperText = gameState.unlocks.editorEditable
    ? ui.editorUnlockedDescription
    : ui.editorLockedDescription
  const editorFeedbackMessage = validationMessage
    ? validationMessage
    : gameState.unlocks.editorEditable
      ? gameState.programValidation.executionStepCount === 0
        ? ui.programZeroStepMessage
        : formatText(ui.programReadyMessage, {
            count: String(gameState.programValidation.executionStepCount),
          })
      : null
  const helperFeedbackMessage = helperValidationMessage
    ? helperValidationMessage
    : functionsUnlocked
      ? ui.helperProgramReadyMessage
      : null
  const editorFeedbackTone = validationMessage
    ? 'error'
    : gameState.unlocks.editorEditable
      ? gameState.programValidation.executionStepCount === 0
        ? 'warning'
        : 'success'
      : 'neutral'
  const helperFeedbackTone = helperValidationMessage ? 'error' : 'success'
  const statusMessage =
    activeTask !== null
      ? ui.challengeActiveMessage
      : gameState.isRunning
        ? ui.runPanelRunningMessage
        : !gameState.unlocks.editorEditable
          ? remainingTasksForEditorUnlock === 1
            ? ui.editorUnlockOneTaskMessage
            : formatText(ui.editorUnlockManyTasksMessage, {
                count: String(remainingTasksForEditorUnlock),
              })
          : runsUntilChallenge === null
            ? ui.allTasksCompletedMessage
            : formatText(ui.taskAfterCommandsMessage, {
                count: String(runsUntilChallenge),
              })
  const runTutorial =
    visibleTutorialStep === 'run_program' ? tutorialContent : null
  const editorTutorial =
    visibleTutorialStep === 'editor_unlock' ? tutorialContent : null
  const taskTutorial =
    visibleTutorialStep === 'first_challenge' ? tutorialContent : null
  const availableFunctions = ['drop_ball()']
  if (gameState.unlocks.allowedCommands.includes('set_aim')) {
    availableFunctions.push('set_aim(2)')
  }
  const readableValues = ['bonus_lane']
  const availableStructures = [
    ...(gameState.unlocks.unlockedConstructs.includes('if')
      ? ['if bonus_lane == 1:']
      : []),
    ...(functionsUnlocked ? ['def follow_bonus():'] : []),
    ...(gameState.unlocks.unlockedConstructs.includes('for')
      ? [`for _ in range(1..${MAX_FOR_RANGE}):`]
      : []),
  ]
  const availableLimits = [
    formatText(ui.availableSyntaxStepLimit, {
      limit: String(MAX_STEPS_PER_RUN),
    }),
    ...(gameState.unlocks.unlockedConstructs.includes('for')
      ? [
          formatText(ui.availableSyntaxRangeLimit, {
            limit: String(MAX_FOR_RANGE),
          }),
        ]
      : []),
  ]
  const taskProgress =
    runsUntilChallenge === null || gameState.currentTaskTarget === 0
      ? 1
      : gameState.dropsTowardNextTask / gameState.currentTaskTarget

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, locale)
  }, [locale])

  useEffect(() => {
    if (
      !gameState.isRunning &&
      gameState.activeBalls.length === 0 &&
      gameState.pendingTaskId === null
    ) {
      return
    }

    const intervalId = window.setInterval(() => {
      setGameState((currentState) => advanceProgramRun(currentState, tasks))
    }, 50)

    return () => window.clearInterval(intervalId)
  }, [
    gameState.isRunning,
    gameState.activeBalls.length,
    gameState.pendingTaskId,
    tasks,
  ])

  useEffect(() => {
    if (gameState.activeBalls.length === 0) {
      return
    }

    const intervalId = window.setInterval(() => {
      setAnimationNow(Date.now())
    }, 16)

    return () => window.clearInterval(intervalId)
  }, [gameState.activeBalls.length])

  const handleRunProgram = () => {
    setGameState((currentState) => startProgramRun(currentState))
  }

  const handleTaskResolved = (wasCorrect: boolean, task: GameTask) => {
    setGameState((currentState) =>
      applyTaskResult(currentState, task, wasCorrect),
    )
  }

  const handleProgramChange = (value: string) => {
    startTransition(() => {
      setGameState((currentState) => updateProgramSource(currentState, value))
    })
  }

  const handleHelperProgramChange = (value: string) => {
    startTransition(() => {
      setGameState((currentState) =>
        updateHelperProgramSource(currentState, value),
      )
    })
  }

  const handleDismissTutorial = (tutorialStep: TutorialStep) => {
    setGameState((currentState) =>
      dismissTutorialStep(currentState, tutorialStep),
    )
  }

  const handleChangeView = (view: 'play' | 'shop') => {
    setGameState((currentState) => setCurrentView(currentState, view))
  }

  const handlePurchaseNode = (nodeId: ShopNodeId) => {
    setGameState((currentState) =>
      purchaseShopNode(currentState, nodeId, tasks),
    )
  }

  return (
    <main className="app-shell">
      <section className="app-topbar">
        <div className="topbar-left">
          <p className="eyebrow">{ui.eyebrow}</p>
          {shopIsAvailable ? (
            <nav className="view-tabs" aria-label="Primary">
              <button
                className={`view-tab${gameState.currentView === 'play' ? ' active' : ''}`}
                onClick={() => handleChangeView('play')}
                type="button"
                disabled={gameState.isRunning}
              >
                {ui.playTabLabel}
              </button>
              <button
                className={`view-tab${gameState.currentView === 'shop' ? ' active' : ''}`}
                onClick={() => handleChangeView('shop')}
                type="button"
                disabled={gameState.isRunning}
              >
                {ui.shopTabLabel}
              </button>
            </nav>
          ) : null}
        </div>
        <div className="language-switcher" aria-label={ui.languageLabel}>
          <span className="language-label">{ui.languageLabel}</span>
          <button
            className={`language-button${locale === 'et' ? ' active' : ''}`}
            onClick={() => setLocale('et')}
            type="button"
            aria-pressed={locale === 'et'}
          >
            {ui.estonianLabel}
          </button>
          <button
            className={`language-button${locale === 'en' ? ' active' : ''}`}
            onClick={() => setLocale('en')}
            type="button"
            aria-pressed={locale === 'en'}
          >
            {ui.englishLabel}
          </button>
        </div>
      </section>

      <section className="dashboard">
        <article className="stat-card">
          <span className="stat-label">{ui.scoreLabel}</span>
          <strong className="stat-value">{gameState.score}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">{ui.runCountLabel}</span>
          <strong className="stat-value">{gameState.runCount}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">{ui.multiplierLabel}</span>
          <strong className="stat-value">{gameState.multiplier}x</strong>
        </article>
      </section>

      {gameState.currentView === 'play' ? (
        <section className="play-panel">
          <div className="editor-column">
            <ProgramEditor
              code={gameState.programSource}
              title={ui.editorTitle}
              variant="main"
              ui={ui}
              isEditable={gameState.unlocks.editorEditable && !gameState.isRunning}
              isUnlocked={gameState.unlocks.editorEditable}
              isHighlighted={visibleTutorialStep === 'editor_unlock'}
              activeLineNumber={gameState.activeLineNumber}
              lineUsageText={lineUsageText}
              helperText={editorHelperText}
              feedbackMessage={editorFeedbackMessage}
              feedbackTone={editorFeedbackTone}
              tutorialTitle={editorTutorial?.title ?? null}
              tutorialMessage={editorTutorial?.message ?? null}
              onDismissTutorial={() => handleDismissTutorial('editor_unlock')}
              onChange={handleProgramChange}
            />

            {functionsUnlocked ? (
              <ProgramEditor
                code={gameState.helperProgramSource}
                title={ui.helperEditorTitle}
                variant="helper"
                ui={ui}
                isEditable={!gameState.isRunning}
                isUnlocked
                isHighlighted={false}
                activeLineNumber={null}
                lineUsageText={helperUsageText}
                helperText={ui.helperEditorUnlockedDescription}
                feedbackMessage={helperFeedbackMessage}
                feedbackTone={helperFeedbackTone}
                tutorialTitle={null}
                tutorialMessage={null}
                onDismissTutorial={() => {}}
                onChange={handleHelperProgramChange}
              />
            ) : null}

            <AvailableSyntaxCard
              ui={ui}
              functions={availableFunctions}
              structures={availableStructures}
              readableValues={readableValues}
              limits={availableLimits}
            />
          </div>

          <div className="utility-column">
            <aside
              className={`controls${
                visibleTutorialStep === 'run_program' ? ' tutorial-target' : ''
              }`}
            >
              <p className="panel-kicker">{ui.runPanelTitle}</p>
              {runTutorial !== null ? (
                <TutorialSpotlight
                  label={ui.tutorialLabel}
                  title={runTutorial.title}
                  message={runTutorial.message}
                  dismissLabel={ui.tutorialDismissButton}
                  onDismiss={() => handleDismissTutorial('run_program')}
                />
              ) : null}
              <button
                className="run-button"
                onClick={handleRunProgram}
                disabled={
                  activeTask !== null ||
                  !gameState.programValidation.isValid ||
                  (functionsUnlocked && !gameState.helperProgramValidation.isValid) ||
                  gameState.isRunning
                }
                type="button"
              >
                {gameState.isRunning ? ui.runButtonRunning : ui.runButton}
              </button>
              <p className="status-copy">{statusMessage}</p>
              {runsUntilChallenge !== null ? (
                <div className="task-progress">
                  <div className="task-progress-header">
                    <span>{ui.nextTaskLabel}</span>
                    <strong>
                      {formatText(ui.nextTaskProgressText, {
                        count: String(runsUntilChallenge),
                      })}
                    </strong>
                  </div>
                  <div className="task-progress-track" aria-hidden="true">
                    <span
                      className="task-progress-bar"
                      style={{ width: `${Math.max(6, taskProgress * 100)}%` }}
                    />
                  </div>
                </div>
              ) : null}
              <dl className="control-stats">
                <div>
                  <dt>{ui.actionsPerRunLabel}</dt>
                  <dd>{ballsPerRunText}</dd>
                </div>
                <div>
                  <dt>{ui.programStatusLabel}</dt>
                  <dd>{programStatus}</dd>
                </div>
              </dl>
            </aside>

            <PachinkoBoard
              ui={ui}
              activeBalls={gameState.activeBalls}
              bonusLane={gameState.bonusLane}
              now={animationNow}
            />

            <ActivityFeed
              entries={gameState.feedEntries}
              tasks={tasks}
              shopNodes={shopNodes}
              ui={ui}
            />
          </div>
        </section>
      ) : (
        <ShopTree
          gameState={gameState}
          tasks={tasks}
          shopNodes={shopNodes}
          ui={ui}
          onPurchase={handlePurchaseNode}
        />
      )}

      <TaskModal
        key={activeTask?.id ?? 'no-task'}
        task={activeTask}
        ui={ui}
        tutorialTitle={taskTutorial?.title ?? null}
        tutorialMessage={taskTutorial?.message ?? null}
        onDismissTutorial={() => handleDismissTutorial('first_challenge')}
        onResolved={handleTaskResolved}
      />
    </main>
  )
}

export default App
