import type { Message } from 'grammy/types'
import type { BotSelf, ReadMessagesAction } from '../../../types'

import { env } from 'node:process'
import { useLogg } from '@guiiai/logg'
import { embed } from '@xsai/embed'
import { generateText } from '@xsai/generate-text'
import { message } from '@xsai/utils-chat'

import { findLastNMessages, findRelevantMessages } from '../../../models'
import { recordChatCompletions } from '../../../models/chat-completions-history'
import { chatMessageToOneLine, telegramMessageToOneLine } from '../../../models/common'
import { personality } from '../../../prompts/system-v1'
import { sendMayStructuredMessage } from '../utils/message'

export async function readMessage(
  state: BotSelf,
  botId: string,
  chatId: string,
  action: ReadMessagesAction,
  unreadMessages: Message[],
  abortController: AbortController,
): Promise<{
    loop?: boolean
    break?: boolean
  }> {
  const logger = useLogg('readMessage').useGlobalConfig()

  const lastNMessages = await findLastNMessages(action.chatId, 100)
  const lastNMessagesOneliner = lastNMessages.map(msg => chatMessageToOneLine(botId, msg)).join('\n')
  logger.withField('number_of_last_n_messages', lastNMessages.length).log('Successfully found last N messages')

  const unreadMessagesEmbeddingPromises = unreadMessages
    .filter(msg => !!msg.text || !!msg.caption)
    .map(async (msg: Message) => {
      const embeddingResult = await embed({
        baseURL: env.EMBEDDING_API_BASE_URL!,
        apiKey: env.EMBEDDING_API_KEY!,
        model: env.EMBEDDING_MODEL!,
        input: msg.text || msg.caption || '',
        abortSignal: abortController.signal,
      })

      return embeddingResult
    })
  const unreadHistoryMessagesEmbedding = await Promise.all(unreadMessagesEmbeddingPromises)
  logger.withField('number_of_tasks', unreadMessagesEmbeddingPromises.length).log('Successfully embedded unread history messages')

  const unreadHistoryMessages = await Promise.all(state.unreadMessages[action.chatId].map(msg => telegramMessageToOneLine(botId, msg)))
  const unreadHistoryMessageOneliner = unreadHistoryMessages.join('\n')

  const existingKnownMessages = [...unreadMessages.map(msg => msg.message_id.toString()), ...lastNMessages.map(msg => msg.platform_message_id)]
  const relevantChatMessages = await findRelevantMessages(botId, chatId, unreadHistoryMessagesEmbedding, existingKnownMessages)
  const relevantChatMessagesOneliner = relevantChatMessages.map(async msgs => msgs.join('\n')).join('\n')
  logger.withField('number_of_relevant_chat_messages', relevantChatMessages.length).log('Successfully composed relevant chat messages')

  state.unreadMessages[action.chatId] = []

  const messages = message.messages(
    personality(),
    message.user(''
      + `Currently, it\'s ${new Date()} on the server that hosts you.`
      + 'The others in the group may live in a different timezone, so please be aware of the time difference.'
      + '\n'
      + 'You choose to read the messages from the group (perhaps you are already engaging the topics in the group).'
      + 'Imaging you are using Telegram app on the mobile phone, and you are reading the messages from the group chat.'
      + '\n'
      + 'Previous 30 messages (including what you said):\n'
      + `${lastNMessagesOneliner || 'No messages'}`
      + '\n'
      + 'All the messages you requested to read:\n'
      + `${unreadHistoryMessageOneliner || 'No messages'}`
      + '\n'
      + 'Relevant chat messages may help you recall the memories:\n'
      + `${relevantChatMessagesOneliner || 'No relevant messages'}`
      + '\n'
      + 'Based on your personalities, imaging you have your own choice and interest over different topics, '
      + 'giving the above context and chat history, would you like to participate in the conversation '
      + 'about the topic? Or will you aggressively diss or piss off about the opinions of others?\n'
      + 'Feel free to ignore by just sending an empty array within a object with key "messages" (i.e.'
      + '{ "messages": [] }).'
      + 'If you would like to participate, send me an array of messages (i.e. { "messages": [] }) you would '
      + 'like to send without telling you willing to participate.'
      + 'If you would like to reply to any of the message, send me an array of messages (i.e. { "messages":'
      + '["message content"], "reply_to_message_id": "1234567890" }) with the message id of the message you '
      + 'want to reply to.'
      + '\n'
      + 'Choose your action.',
    ),
  )

  let responseText = ''

  try {
    const response = await generateText({
      apiKey: env.LLM_API_KEY!,
      baseURL: env.LLM_API_BASE_URL!,
      model: env.LLM_MODEL!,
      messages,
      abortSignal: abortController.signal,
    })

    responseText = response.text
      .replace(/^```json\s*\n/, '')
      .replace(/\n```$/, '')
      .replace(/^```\s*\n/, '')
      .replace(/\n```$/, '')
      .trim()
  }
  catch (err) {
    logger.withField('error', err).log('Failed to generate response')
  }
  finally {
    recordChatCompletions('readMessage', messages, responseText).then(() => {}).catch(err => logger.withField('error', err).log('Failed to record chat completions'))
  }

  logger.withField('response', responseText).log('Successfully generated response')
  await sendMayStructuredMessage(state, responseText, action.chatId.toString())

  return { break: true }
}
