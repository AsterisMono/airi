import type { Message as LLMMessage } from '@xsai/shared-chat'
import type { Message } from 'grammy/types'
import type { BotSelf, ReadMessagesAction } from '../../../types'

import { env } from 'node:process'
import { useLogg } from '@guiiai/logg'
import { embed } from '@xsai/embed'
import { generateText } from '@xsai/generate-text'
import { message } from '@xsai/utils-chat'

import { findLastNMessages, findRelevantMessages } from '../../../models'
import { chatMessageToOneLine, telegramMessageToOneLine } from '../../../models/common'
import { systemPrompt } from '../../../prompts/system-v1'
import { sendMayStructuredMessage } from '../utils/message'

export async function readMessage(state: BotSelf, msgs: LLMMessage[], action: ReadMessagesAction, forGroupId?: string): Promise<{
  loop?: boolean
  break?: boolean
}> {
  const logger = useLogg('readMessage').useGlobalConfig()

  if (forGroupId && forGroupId === action.groupId.toString()
    && state.unreadMessages[action.groupId]
    && state.unreadMessages[action.groupId].length > 0) {
    state.logger.log(`Interrupting message processing for group ${action.groupId} - new messages arrived`)
    return { loop: true }
  }
  if (Object.keys(state.unreadMessages).length === 0) {
    return { break: true }
  }
  if (action.groupId == null) {
    return { break: true }
  }
  if (state.unreadMessages[action.groupId].length === 0) {
    delete state.unreadMessages[action.groupId]
    return { break: true }
  }

  const lastNMessages = await findLastNMessages(action.groupId, 30)
  const lastNMessagesOneliner = lastNMessages.map(msg => chatMessageToOneLine(msg)).join('\n')

  logger.withField('number_of_last_n_messages', lastNMessages.length).log('Successfully found last N messages')

  const unreadMessages = state.unreadMessages[action.groupId] as Message[]
  const unreadMessagesEmbeddingPromises = unreadMessages
    .filter(msg => !!msg.text || !!msg.caption)
    .map(async (msg: Message) => {
      const embeddingResult = await embed({
        baseURL: env.EMBEDDING_API_BASE_URL!,
        apiKey: env.EMBEDDING_API_KEY!,
        model: env.EMBEDDING_MODEL!,
        input: msg.text || msg.caption || '',
        abortSignal: state.currentAbortController.signal,
      })

      return {
        embedding: embeddingResult.embedding,
        message: msg,
      }
    })

  const unreadHistoryMessagesEmbedding = await Promise.all(unreadMessagesEmbeddingPromises)

  logger.withField('number_of_tasks', unreadMessagesEmbeddingPromises.length).log('Successfully embedded unread history messages')

  const unreadHistoryMessages = await Promise.all(state.unreadMessages[action.groupId].map(msg => telegramMessageToOneLine(state.bot, msg)))
  const unreadHistoryMessageOneliner = unreadHistoryMessages.join('\n')
  state.unreadMessages[action.groupId] = []

  const relevantChatMessages = await findRelevantMessages(unreadHistoryMessagesEmbedding)
  const relevantChatMessagesOneliner = (await Promise.all(relevantChatMessages.map(async msgs => msgs.join('\n')))).join('\n')

  logger.withField('number_of_relevant_chat_messages', relevantChatMessages.length).log('Successfully composed relevant chat messages')

  const messages = message.messages(
    systemPrompt(),
    message.user(''
      + `Currently, it\'s ${new Date()} on the server that hosts you.`
      + 'The others in the group may live in a different timezone, so please be aware of the time difference.'
      + '\n'
      + 'Last 30 messages:\n'
      + `${lastNMessagesOneliner || 'No messages'}`
      + '\n'
      + 'I helped you searched these relevant chat messages may help you recall the memories:'
      + `${relevantChatMessagesOneliner || 'No relevant messages'}`
      + '\n'
      + 'All the messages you requested to read:'
      + `${unreadHistoryMessageOneliner || 'No messages'}`
      + '\n'
      + 'Choose your action. Would you like to say something? Or ignore?',
    ),
  )

  // eslint-disable-next-line no-console
  console.log(messages)

  const response = await generateText({
    apiKey: env.LLM_API_KEY!,
    baseURL: env.LLM_API_BASE_URL!,
    model: env.LLM_MODEL!,
    messages,
    abortSignal: state.currentAbortController.signal,
  })

  response.text = response.text
    .replace(/^```json\s*\n/, '')
    .replace(/\n```$/, '')
    .replace(/^```\s*\n/, '')
    .replace(/\n```$/, '')
    .trim()

  logger.withField('response', JSON.stringify(response.text)).log('Successfully generated response')

  await sendMayStructuredMessage(state, response.text, action.groupId.toString())
  return { break: true }
}
