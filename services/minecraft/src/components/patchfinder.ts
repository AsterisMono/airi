// This is an example that uses mineflayer-pathfinder to showcase how simple it is to walk to goals

import type { ComponentLifecycle, Context } from '../bot'
import { useLogg } from '@guiiai/logg'
import { goals, Movements, pathfinder } from 'mineflayer-pathfinder'

export function createPathFinderComponent(ctx: Context): ComponentLifecycle {
  const RANGE_GOAL = 1 // get within this radius of the player

  const logger = useLogg('pathfinder').useGlobalConfig()
  logger.log('Loading pathfinder plugin')

  ctx.bot.loadPlugin(pathfinder)

  let defaultMove: Movements

  const onChat = (username: string, message: string) => {
    if (username === ctx.bot.username)
      return
    if (message !== 'come')
      return

    logger.withFields({ username, message }).log('Chat message received')
    const target = ctx.bot.players[username]?.entity
    if (!target) {
      ctx.bot.chat('I don\'t see you !')
      return
    }

    const { x: playerX, y: playerY, z: playerZ } = target.position

    ctx.bot.pathfinder.setMovements(defaultMove)
    ctx.bot.pathfinder.setGoal(new goals.GoalNear(playerX, playerY, playerZ, RANGE_GOAL))
  }

  ctx.bot.once('spawn', () => {
    defaultMove = new Movements(ctx.bot)
    ctx.bot.on('chat', onChat)
  })

  return {
    cleanup: () => {
      ctx.bot.removeListener('chat', onChat)
    },
  }
}
