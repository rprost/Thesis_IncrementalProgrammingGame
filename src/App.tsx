import { startTransition, useEffect, useState } from 'react'
import './App.css'
import { ActivityFeed } from './components/ActivityFeed'
import { AvailableSyntaxCard } from './components/AvailableSyntaxCard'
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
  updateProgramSource,
} from './game/engine'
import { MAX_FOR_RANGE, MAX_STEPS_PER_RUN } from './game/program'
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

function getNextUnlockText(
  gameState: ReturnType<typeof createInitialGameState>,
  ui: UiText,
): string {
  if (!gameState.unlocks.editorEditable) {
    return ui.availableSyntaxNextEditor
  }

  if (!gameState.purchasedUpgradeIds.includes('line_capacity_3')) {
    return ui.availableSyntaxNextLine
  }

  if (!gameState.unlocks.unlockedConstructs.includes('for')) {
    return ui.availableSyntaxNextFor
  }

  return ui.availableSyntaxNextVariables
}

function App() {
  const [locale, setLocale] = useState<Locale>(() => getInitialLocale())
  const [gameState, setGameState] = useState(() => createInitialGameState())

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

  const runsUntilChallenge = getRunsUntilChallenge(gameState, tasks)
  const validationMessage = getProgramValidationMessage(
    gameState.programValidation,
    ui,
  )
  const lineUsageText = formatText(ui.editorLineUsageValue, {
    used: String(gameState.programValidation.executableLineCount),
    limit: String(gameState.unlocks.lineCapacity),
  })
  const actionsPerRunText = formatText(ui.actionsPerRunValue, {
    count: String(gameState.programValidation.executionStepCount),
  })
  const programStatus = gameState.isRunning
    ? ui.programStatusRunning
    : !gameState.unlocks.editorEditable
      ? ui.programStatusLocked
      : gameState.programValidation.isValid
        ? ui.programStatusReady
        : ui.programStatusInvalid
  const editorHelperText = gameState.unlocks.editorEditable
    ? ui.editorUnlockedDescription
    : ui.editorLockedDescription
  const editorFeedbackMessage = validationMessage
    ? validationMessage
    : gameState.unlocks.editorEditable
      ? formatText(ui.programReadyMessage, {
          count: String(gameState.programValidation.executionStepCount),
        })
      : null
  const editorFeedbackTone = validationMessage
    ? 'error'
    : gameState.unlocks.editorEditable
      ? 'success'
      : 'neutral'
  const controlsHint = gameState.unlocks.editorEditable
    ? ui.controlsHintEditable
    : ui.controlsHintLocked
  const runTutorial =
    visibleTutorialStep === 'run_program' ? tutorialContent : null
  const editorTutorial =
    visibleTutorialStep === 'editor_unlock' ? tutorialContent : null
  const taskTutorial =
    visibleTutorialStep === 'first_challenge' ? tutorialContent : null
  const availableStructures = gameState.unlocks.unlockedConstructs.includes('for')
    ? [`for _ in range(1..${MAX_FOR_RANGE}):`]
    : []
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

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, locale)
  }, [locale])

  useEffect(() => {
    if (!gameState.isRunning || gameState.queuedSteps.length === 0) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setGameState((currentState) => advanceProgramRun(currentState, tasks))
    }, 120)

    return () => window.clearTimeout(timeoutId)
  }, [gameState.isRunning, gameState.queuedSteps, tasks])

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

  const handleDismissTutorial = (tutorialStep: TutorialStep) => {
    setGameState((currentState) =>
      dismissTutorialStep(currentState, tutorialStep),
    )
  }

  const handleChangeView = (view: 'play' | 'shop') => {
    setGameState((currentState) => setCurrentView(currentState, view))
  }

  const handlePurchaseNode = (nodeId: ShopNodeId) => {
    setGameState((currentState) => purchaseShopNode(currentState, nodeId))
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

            <AvailableSyntaxCard
              ui={ui}
              functions={['add_score()']}
              structures={availableStructures}
              limits={availableLimits}
              nextUnlock={getNextUnlockText(gameState, ui)}
            />
          </div>

          <div className="utility-grid">
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
                  gameState.isRunning
                }
                type="button"
              >
                {gameState.isRunning ? ui.runButtonRunning : ui.runButton}
              </button>
              <p className="status-copy">
                {activeTask !== null
                  ? ui.challengeActiveMessage
                  : gameState.isRunning
                    ? ui.runPanelRunningMessage
                    : runsUntilChallenge === null
                      ? ui.allTasksCompletedMessage
                      : `${ui.nextChallengeLabel} ${runsUntilChallenge}`}
              </p>
              <p className="control-hint">{controlsHint}</p>
              <dl className="control-stats">
                <div>
                  <dt>{ui.actionsPerRunLabel}</dt>
                  <dd>{actionsPerRunText}</dd>
                </div>
                <div>
                  <dt>{ui.programStatusLabel}</dt>
                  <dd>{programStatus}</dd>
                </div>
              </dl>
            </aside>

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
