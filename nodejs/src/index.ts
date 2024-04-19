import { writeFile } from 'fs'
import 'dotenv/config'

type ErrorResponse = {
  status: string
  message: string
  correlationId: string
  category: string
}

type ChannelsResponse = {
  total: number
  results: Channel[]
}

type PaginationResponse<T> = {
  results: T[],
  paging: {
    next: {
      after: string
      link: string
    }
  }
}

type Channel = {
  id: string
  name: string
}

type Thread = {
  id: string
  createdAt: string
  closedAt: string
  status: string
  originalChannelId: string
  originalChannelAccountId: string
  latestMessageTimestamp: string
  latestMessageSentTimestamp: string
  latestMessageReceivedTimestamp: string
  assignedTo: string
  spam: boolean
  inboxId: string
  associatedContactId: string
  archived: boolean
}

type Message = {
  text: string
  createdAt: string
  type: 'MESSAGE' | 'WELCOME_MESSAGE' | 'ASSIGNMENT' | 'THREAD_STATUS_CHANGE'
  direction: 'OUTGOING' | 'INCOMING'
  channelId: string
}

type ExportJson = ExportThread[]

type ExportThread = {
  id: string
  createdAt: string
  closed: boolean
  messages: ExportMessage[]
}

type ExportMessage = {
  createdAt: string
  text: string
  direction: 'in' | 'out'
}


const TOKEN = process.env.TOKEN
const CHANNEL = process.env.CHANNEL
const WAIT_MS = parseInt(process.env.WAIT_MS || '0')

async function fetchData () {
  if (!WAIT_MS) {
    throw new Error(`Provide a value for WAIT_MS, otherwise HubSpot will probably block you`)
  }
  const channels = await apiReadChannels()
  const chat = channels.find(c => c.name === CHANNEL)
  if (!chat) {
    throw new Error(`Could not find channel '${CHANNEL}' for live chats`)
  }
  console.log(`Using channel id ${chat.id} for ${CHANNEL}`)

  const threads = await apiReadThreads(chat.id)

  const result = await apiReadMessages(threads, chat.id)

  await writeToFile(result)
}

async function apiReadChannels(): Promise<Channel[]> {
  console.log('Reading HubSpot channels...')
  const res = await fetch('https://api.hubapi.com/conversations/v3/conversations/channels', {
    headers: {
      authorization: `Bearer ${TOKEN}`
    }
  })
  const data = await res.json()
  if (data.status === 'error') {
    throw new Error(`${data.category}: ${data.message}`)
  }
  return (data as ChannelsResponse).results
}


async function apiReadThreads(channelId: string): Promise<Thread[]> {
  console.log('Reading HubSpot threads...')
  let after = ''
  let result: Thread[] = []
  do {
    let url = 'https://api.hubapi.com/conversations/v3/conversations/threads?limit=100'
    if (after) {
      url += `&after=${after}`
    }
    const res = await fetch(url, {
      headers: {
        authorization: `Bearer ${TOKEN}`
      }
    })
    const data = await res.json() as  PaginationResponse<Thread>
    const threads = filterThreads(data.results || [], channelId)
    result = result.concat(threads)
    const newAfter = data.paging.next.after || ''
    console.log(`threads: ${result.length}`)
    if (after === newAfter) {
      break
    }
    after = newAfter
    await new Promise(resolve => setTimeout(resolve, WAIT_MS))
  } while (after)
  
  return result
}

async function apiReadMessages(threads: Thread[], channelId: string): Promise<ExportJson> {
  console.log('Reading HubSpot messages...')
  let result: ExportJson = []

  const stepSize = 20
  for (const [i, thread] of threads.entries()) {
    if ((i+1) % stepSize === 0) {
      console.log(`thread ${i+1}/${threads.length}...`)
    }
    const messages = await apiReadMessagesOfThread(thread, channelId)
    const exportThread: ExportThread = {
      id: thread.id,
      createdAt: thread.createdAt,
      closed: thread.status === 'CLOSED',
      messages: messages.map(m => ({
        createdAt: m.createdAt,
        direction: m.direction === 'INCOMING' ? 'in' : 'out',
        text: maskSensitiveInformation(m.text)
      }))
    }
    result.push(exportThread)
  }
  return result
}

async function apiReadMessagesOfThread(thread: Thread, channelId: string) {
  let after = ''
  let result: Message[] = []
  do {
    let url = `https://api.hubapi.com/conversations/v3/conversations/threads/${thread.id}/messages?limit=100&sort=createdAt`
    if (after) {
      url += `&after=${after}`
    }
    const res = await fetch(url, {
      headers: {
        authorization: `Bearer ${TOKEN}`
      }
    })
    const data = await res.json() as  PaginationResponse<Message>
    const messages = filterMessages(data.results || [], channelId)
    result = result.concat(messages)
    const newAfter = data.paging.next.after || ''
    if (after === newAfter) {
      break
    }
    after = newAfter
    await new Promise(resolve => setTimeout(resolve, WAIT_MS))
  } while (after)
  
  return result
}

function filterThreads (data: Thread[], channelId: string) {
  return data.filter(t => t.originalChannelId === channelId)
}

function filterMessages (data: Message[], channelId: string) {
  return data.filter(m => m.channelId === channelId && ['MESSAGE', 'WELCOME_MESSAGE'].includes(m.type))
}

function maskSensitiveInformation (text: string): string {
  const mask = "<<##removed##>>"
  const phoneRegex = /(?:\+\d{1,3}\s*)?(?:\(\d{1,5}\)\s*)?\b(?![a-z\d]+\.[a-z]{2,6}\b)\d{3,}(?:[-\s./]?\d{2,}){1,2}\b/gi;
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
  let result = text.replace(emailRegex, mask)
  return result.replace(phoneRegex, mask)
}

async function writeToFile(data: ExportJson) {
  const fileName = 'chats.json'
  console.log(`writing to file: ${fileName}`)
  writeFile(fileName, JSON.stringify(data, null, 2), (error) => {
    if (error) {
      console.error(error)
      throw error
    }
  })
}

fetchData()
