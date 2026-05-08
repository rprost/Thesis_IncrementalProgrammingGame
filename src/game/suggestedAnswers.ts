import type { GameTask } from '../types'

export function getSuggestedTaskAnswer(task: GameTask): string | null {
  if (task.archetype !== 'write') {
    const correctOption =
      task.correctOption === undefined ? undefined : task.options?.[task.correctOption]

    return correctOption ?? null
  }

  switch (task.id) {
    case 'variables-write':
      return [
        'target = portal_side',
        'choose_input(4 - target)',
        'drop_ball()',
      ].join('\n')
    case 'functions-write':
      return [
        'def follow_portal():',
        '    choose_input(portal_side)',
        '    drop_ball()',
      ].join('\n')
    case 'loops-write':
      return [
        'for shot in range(4):',
        '    if next_ball == negative_ball:',
        '        skip_ball()',
        '        continue',
        '    if next_ball == center_ball:',
        '        choose_input(2)',
        '    else:',
        '        choose_input(portal_side)',
        '    drop_ball()',
      ].join('\n')
    case 'lists-write':
      return [
        'worst_multiplier = bonus_map[0]',
        'worst_index = 0',
        'index = 0',
        'for multiplier in bonus_map:',
        '    if multiplier < worst_multiplier:',
        '        worst_multiplier = multiplier',
        '        worst_index = index',
        '    index = index + 1',
        'choose_input(worst_index + 1)',
        'drop_ball()',
      ].join('\n')
    default:
      return task.writeValidation?.starterSource ?? null
  }
}
