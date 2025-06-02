import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { prisma } from '@/lib/db/client'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const flashModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' })

export async function POST(request: NextRequest, props: { params: Promise<{ chatId: string }> }) {
  const params = await props.params;
  try {
    const { chatId } = params

    // Get the chat with messages
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 10 // Use first 10 messages to generate title
        }
      }
    })

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    // Don't generate title if there are no real messages (only welcome message)
    if (chat.messages.length <= 1) {
      return NextResponse.json({ title: 'New Chat' })
    }

    // Prepare conversation for title generation
    const conversation = chat.messages
      .map((msg: any) => `${msg.role === 'assistant' ? 'AI' : 'User'}: ${msg.content}`)
      .join('\n\n')

    // Generate title using Gemini
    const prompt = `Based on this medical conversation, generate a very concise and short title (max 5-7 words, ideally 3-4 words, absolute max 50 characters) that captures the main topic or question. The title should be extremely brief and help quickly identify the conversation.

Conversation:
${conversation}

Generate only the title, nothing else. Be very brief.`

    const result = await flashModel.generateContent(prompt)
    const title = result.response.text().trim().slice(0, 50)

    // Update the chat title
    await prisma.chat.update({
      where: { id: chatId },
      data: { title }
    })

    return NextResponse.json({ title })
  } catch (error) {
    console.error('Error generating chat title:', error)
    return NextResponse.json(
      { error: 'Failed to generate title' },
      { status: 500 }
    )
  }
}
