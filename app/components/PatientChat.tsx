'use client'

import { useState, useEffect, useRef, FormEvent, useCallback } from 'react'
import { Send, X, MessageCircle, Loader2, History, Plus, Trash2, GripVertical } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

interface Chat {
  id: string
  title: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  messages: Message[]
  _count?: {
    messages: number
  }
}

interface Study {
  id: string
  title: string
  modality: string | null
  imagingDatetime: string
  seriesSummary: string
}

interface PatientChatProps {
  patientId: string
  isOpen: boolean
  onClose: () => void
  patientName?: string
  studies?: Study[]
  onCitationClick: (studyId: string) => void
}

const PatientChat: React.FC<PatientChatProps> = ({ patientId, isOpen, onClose, patientName, studies = [], onCitationClick }) => {
  const [currentChat, setCurrentChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [chatHistory, setChatHistory] = useState<Chat[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [isCreatingChat, setIsCreatingChat] = useState(false)
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(true)
  const [width, setWidth] = useState(400) // Default width in pixels
  const [isResizing, setIsResizing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const historyPanelRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Min and max width constraints
  const MIN_WIDTH = 300
  const MAX_WIDTH = typeof window !== 'undefined' ? Math.min(800, window.innerWidth * 0.6) : 800

  // Resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    
    const newWidth = window.innerWidth - e.clientX
    const constrainedWidth = Math.min(Math.max(newWidth, MIN_WIDTH), MAX_WIDTH)
    setWidth(constrainedWidth)
  }, [isResizing, MIN_WIDTH, MAX_WIDTH])

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  // Resize event listeners
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    } else {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  // Suggested questions
  const suggestedQuestions = [
    "What are the key findings in this patient's imaging studies?",
    "Can you explain the clinical significance of the latest report?",
    "What follow-up recommendations are suggested for this patient?"
  ]

  // Delete a chat
  const deleteChat = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setChatHistory(prev => prev.filter(chat => chat.id !== chatId))
        if (currentChat?.id === chatId) {
          // If current chat is deleted, show welcome screen again
          setCurrentChat(null)
          setMessages([])
          setShowWelcomeScreen(true)
        }
      }
    } catch (error) {
      console.error('Error deleting chat:', error)
    }
  }

  // Create a map of study IDs to study objects for easy lookup
  const studyMap = new Map<string, Study>()
  studies.forEach(study => {
    studyMap.set(study.id, study)
  })

  // Load chat history
  const loadChatHistory = async () => {
    setIsLoadingHistory(true)
    try {
      const response = await fetch(`/api/chats?patientId=${patientId}`)
      if (response.ok) {
        const chats = await response.json()
        setChatHistory(chats)
      }
    } catch (error) {
      console.error('Error loading chat history:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  // Load a specific chat
  const loadChat = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chats/${chatId}`)
      if (response.ok) {
        const chat = await response.json()
        setCurrentChat(chat)
        setMessages(chat.messages || [])
        setShowHistory(false)
        setShowWelcomeScreen(false)
        
        // Set this chat as active
        await fetch(`/api/chats/${chatId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: true })
        })
      }
    } catch (error) {
      console.error('Error loading chat:', error)
    }
  }

  // Create a new chat (only called after user sends first message)
  const createNewChatAfterMessage = async (userMessage: Message) => {
    setIsCreatingChat(true)
    try {
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId })
      })
      
      if (response.ok) {
        const newChat = await response.json()
        setCurrentChat(newChat)
        setShowWelcomeScreen(false)
        await loadChatHistory() // Refresh history
        
        // Save the user message to the new chat
        await fetch(`/api/chats/${newChat.id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'user',
            content: userMessage.content
          })
        })

        return newChat
      }
    } catch (error) {
      console.error('Error creating new chat:', error)
    } finally {
      setIsCreatingChat(false)
    }
    return null
  }

  // Create a new empty chat (from New Chat button)
  const createNewChat = async () => {
    setCurrentChat(null)
    setMessages([])
    setShowWelcomeScreen(true)
    setShowHistory(false)
  }

  // Load chat history on mount
  useEffect(() => {
    if (isOpen) {
      loadChatHistory()
    }
  }, [isOpen])

  // Click outside handler for history panel
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showHistory && historyPanelRef.current && !historyPanelRef.current.contains(event.target as Node)) {
        // Check if the click was on the history button itself
        const historyButton = document.querySelector('[title="Chat History"]')
        if (historyButton && !historyButton.contains(event.target as Node)) {
          setShowHistory(false)
        }
      }
    }

    if (showHistory) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showHistory])

  // Process text to replace citations with clickable numbers
  const processCitations = (text: string): JSX.Element[] => {
    const parts: JSX.Element[] = []
    let lastIndex = 0
    
    const citationPattern = /\[CITE:([^\]]+)\]/g
    let match: RegExpExecArray | null;
    let citationNumber = 1
    const usedCitations = new Map<string, number>()
    
    while ((match = citationPattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {text.substring(lastIndex, match.index)}
          </span>
        )
      }
      
      const citationIds = match[1].split(',').map(id => id.trim())
      const citationNumbers: number[] = []
      
      citationIds.forEach(studyId => {
        if (!usedCitations.has(studyId)) {
          usedCitations.set(studyId, citationNumber++)
        }
        citationNumbers.push(usedCitations.get(studyId)!)
      })
      
      citationIds.forEach((studyId, index) => {
        const currentCitationNumber = citationNumbers[index];
        if (match) { // Add null check for match
          parts.push(
            <sup key={`cite-${match.index}-${index}`} className="ml-0.5">
              <button
                onClick={() => onCitationClick(studyId)}
                className="text-medical-primary hover:text-medical-primary-dark hover:underline font-medium"
                title={`View study: ${studyMap.get(studyId)?.title || studyId}`}
              >
                [{currentCitationNumber}]
              </button>
            </sup>
          );
          // If it's not the last citation in this group, add a comma and space
          if (index < citationIds.length - 1) {
            parts.push(<span key={`sep-${match.index}-${index}`}>, </span>);
          }
        }
      });
      
      if (match) { // Add null check for match
        lastIndex = match.index + match[0].length
      }
    }
    
    if (lastIndex < text.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {text.substring(lastIndex)}
        </span>
      )
    }
    
    return parts.length > 0 ? parts : [<span key="text-0">{text}</span>]
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(scrollToBottom, [messages])

  // Handle suggested question click
  const handleSuggestedQuestionClick = (question: string) => {
    setInputValue(question)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      createdAt: new Date().toISOString()
    }
    
    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      let chatToUse = currentChat

      // If no current chat (welcome screen), create one after first message
      if (!currentChat) {
        chatToUse = await createNewChatAfterMessage(userMessage)
        if (!chatToUse) {
          throw new Error('Failed to create chat')
        }
      } else {
        // Save user message to existing chat
        await fetch(`/api/chats/${currentChat.id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'user',
            content: userMessage.content
          })
        })
      }

      // Prepare messages for the API
      const apiMessages = messages.concat(userMessage).map(msg => ({
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts: [{ text: msg.content }]
      }))

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, messages: apiMessages }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get response from AI')
      }

      if (!response.body) {
        throw new Error('Response body is null')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulatedResponse = ''
      const assistantMessageId = (Date.now() + 1).toString()

      // Add a placeholder for the assistant's message
      setMessages(prev => [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '', // Start with empty content
          createdAt: new Date().toISOString(),
        },
      ])

      let firstChunk = true
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunkText = decoder.decode(value, { stream: true })
        accumulatedResponse += chunkText

        // Update the specific assistant message content
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, content: accumulatedResponse }
              : msg
          )
        )
        if (firstChunk) {
          setIsLoading(false) // Stop full loading indicator after first chunk
          firstChunk = false
        }
      }
      
      // Final message content is in accumulatedResponse
      // Save AI response to database after stream is complete
      if (chatToUse && accumulatedResponse) {
        await fetch(`/api/chats/${chatToUse.id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'assistant',
            content: accumulatedResponse,
          }),
        })
      }

      // Generate a better title after the first real exchange
      if (messages.length === 0 && chatToUse) { // No previous messages (first exchange)
        // Try to generate AI title
        try {
          const titleResponse = await fetch(`/api/chats/${chatToUse.id}/generate-title`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          })
          
          if (titleResponse.ok) {
            const { title } = await titleResponse.json()
            // Update local state
            setCurrentChat(prev => prev ? { ...prev, title } : prev)
            // Refresh chat history
            await loadChatHistory()
          }
        } catch (titleError) {
          console.error('Error generating title:', titleError)
          // Fallback to simple title
          const title = userMessage.content.slice(0, 50) + (userMessage.content.length > 50 ? '...' : '')
          await fetch(`/api/chats/${chatToUse.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
          })
        }
      }
    } catch (error) {
      console.error('Chat API error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Sorry, something went wrong. Please try again.',
        createdAt: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      // setIsLoading(false) // Already set to false after first chunk or if error
    }
  }

  if (!isOpen) return null

  return (
    <div 
      ref={chatContainerRef} 
      className="fixed top-0 right-0 h-full bg-white shadow-xl flex flex-col z-50 border-l border-medical-neutral-200"
      style={{ width: `${width}px` }}
    >
      {/* Resize Handle */}
      <div
        className="absolute top-0 left-0 w-2 h-full cursor-col-resize hover:bg-medical-primary/20 transition-colors flex items-center justify-center group"
        onMouseDown={handleMouseDown}
      >
        <GripVertical className="w-3 h-3 text-medical-neutral-400 group-hover:text-medical-primary" />
      </div>

      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-medical-primary to-medical-primary-dark text-white">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center">
            <MessageCircle size={24} className="mr-2" />
            <h2 className="text-lg font-semibold">Chat with Patient Report</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              title="Chat History"
            >
              <History size={20} />
            </button>
            <button
              onClick={createNewChat}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              title="New Chat"
              disabled={isCreatingChat}
            >
              {isCreatingChat ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
        {currentChat && (
          <div className="text-sm text-white/80">
            {currentChat.title}
          </div>
        )}
      </div>

      {/* Chat History Panel */}
      {showHistory && (
        <div ref={historyPanelRef} className="absolute top-16 right-4 w-72 max-h-96 bg-white shadow-lg rounded-lg border border-medical-neutral-200 overflow-hidden z-10">
          <div className="p-3 border-b border-medical-neutral-200 bg-medical-neutral-50">
            <h3 className="font-semibold text-medical-neutral-800">Chat History</h3>
          </div>
          <div className="overflow-y-auto max-h-80">
            {isLoadingHistory ? (
              <div className="p-4 text-center text-medical-neutral-500">
                <Loader2 size={20} className="animate-spin mx-auto mb-2" />
                Loading history...
              </div>
            ) : chatHistory.length === 0 ? (
              <div className="p-4 text-center text-medical-neutral-500">
                No chat history yet
              </div>
            ) : (
              <div className="divide-y divide-medical-neutral-100">
                {chatHistory.map((chat) => (
                  <div
                    key={chat.id}
                    className={`w-full p-3 text-left hover:bg-medical-neutral-50 transition-colors flex items-center justify-between ${
                      chat.id === currentChat?.id ? 'bg-medical-primary/10' : ''
                    }`}
                  >
                    <button 
                      onClick={() => loadChat(chat.id)} 
                      className="flex-grow text-left"
                    >
                      <div className="font-medium text-medical-neutral-800 text-sm mb-1 truncate">
                        {chat.title}
                      </div>
                      <div className="text-xs text-medical-neutral-500">
                        {new Date(chat.updatedAt).toLocaleDateString()} · {chat._count?.messages || 0} messages
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation() // Prevent loading chat when deleting
                        if (window.confirm(`Are you sure you want to delete "${chat.title}"?`)) {
                          deleteChat(chat.id)
                        }
                      }}
                      className="p-1 text-medical-error hover:text-medical-error-dark rounded-md hover:bg-medical-error/10 transition-colors ml-2 flex-shrink-0"
                      title="Delete Chat"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-grow flex flex-col bg-medical-neutral-50 overflow-hidden">
        {showWelcomeScreen ? (
          /* Welcome Screen */
          <div className="flex-grow p-4 space-y-6">
            {/* Suggested Questions */}
            <div className="space-y-3">
              <h4 className="font-medium text-medical-neutral-700">Suggested questions:</h4>
              {suggestedQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestedQuestionClick(question)}
                  className="w-full text-left p-3 bg-white rounded-lg border border-medical-neutral-200 hover:border-medical-primary hover:bg-medical-primary/5 transition-colors"
                >
                  <span className="text-sm text-medical-neutral-700">{question}</span>
                </button>
              ))}
            </div>

            {/* Recent Chat History */}
            {chatHistory.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-medical-neutral-700">Recent conversations:</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {chatHistory.slice(0, 5).map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => loadChat(chat.id)}
                      className="w-full text-left p-3 bg-white rounded-lg border border-medical-neutral-200 hover:border-medical-primary hover:bg-medical-primary/5 transition-colors"
                    >
                      <div className="font-medium text-medical-neutral-800 text-sm mb-1 truncate">
                        {chat.title}
                      </div>
                      <div className="text-xs text-medical-neutral-500">
                        {new Date(chat.updatedAt).toLocaleDateString()} · {chat._count?.messages || 0} messages
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Messages Area */
          <div className="flex-grow p-4 overflow-y-auto space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] p-3 rounded-lg shadow ${
                    msg.role === 'user'
                      ? 'bg-medical-primary text-white rounded-br-none'
                      : 'bg-white text-medical-neutral-800 rounded-bl-none border border-medical-neutral-200'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none text-medical-neutral-800">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }: any) => {
                            const processedChildren = Array.isArray(children) 
                              ? children.map((child, index) => {
                                  if (typeof child === 'string') {
                                    return <span key={index}>{processCitations(child)}</span>
                                  }
                                  return child
                                })
                              : typeof children === 'string' 
                                ? processCitations(children)
                                : children
                            
                            return <p className="mb-2">{processedChildren}</p>
                          },
                          ul: ({ children }: any) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
                          ol: ({ children }: any) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
                          li: ({ children }: any) => {
                            const processedChildren = Array.isArray(children) 
                              ? children.map((child, index) => {
                                  if (typeof child === 'string') {
                                    return <span key={index}>{processCitations(child)}</span>
                                  }
                                  return child
                                })
                              : typeof children === 'string' 
                                ? processCitations(children)
                                : children
                            
                            return <li>{processedChildren}</li>
                          }
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="prose prose-sm max-w-none text-white">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                  <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-white/70 text-right' : 'text-medical-neutral-500 text-left'}`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] p-3 rounded-lg shadow bg-white text-medical-neutral-800 rounded-bl-none flex items-center border border-medical-neutral-200">
                  <Loader2 size={20} className="animate-spin mr-2 text-medical-primary" />
                  <span className="text-sm text-medical-neutral-600">MedChronos AI is typing...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input Area - Always at bottom */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-medical-neutral-200 bg-white">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask about the patient report..."
              className="flex-grow p-2 border border-medical-neutral-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent outline-none"
              disabled={isLoading}
            />
            <button
              type="submit"
              className="p-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark disabled:bg-medical-neutral-400 flex items-center justify-center w-10 h-10"
              disabled={isLoading || !inputValue.trim()}
            >
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PatientChat
