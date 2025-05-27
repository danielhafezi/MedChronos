'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import { Send, X, MessageCircle, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  id: string
  role: 'user' | 'model'
  text: string
  timestamp: string
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
  patientName?: string // Optional: for a more personalized welcome
  studies?: Study[]
  onCitationClick: (studyId: string) => void
}

const PatientChat: React.FC<PatientChatProps> = ({ patientId, isOpen, onClose, patientName, studies = [], onCitationClick }) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Create a map of study IDs to study objects for easy lookup
  const studyMap = new Map<string, Study>()
  studies.forEach(study => {
    studyMap.set(study.id, study)
  })

  // Process text to replace citations with clickable numbers
  const processCitations = (text: string): JSX.Element[] => {
    const parts: JSX.Element[] = []
    let lastIndex = 0
    
    // Find all citations in the text
    const citationPattern = /\[CITE:([^\]]+)\]/g
    let match
    let citationNumber = 1
    const usedCitations = new Map<string, number>()
    
    while ((match = citationPattern.exec(text)) !== null) {
      // Add text before citation
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {text.substring(lastIndex, match.index)}
          </span>
        )
      }
      
      // Process citation
      const citationIds = match[1].split(',').map(id => id.trim())
      const citationNumbers: number[] = []
      
      citationIds.forEach(studyId => {
        if (!usedCitations.has(studyId)) {
          usedCitations.set(studyId, citationNumber++)
        }
        citationNumbers.push(usedCitations.get(studyId)!)
      })
      
      // Add clickable citation
      parts.push(
        <sup key={`cite-${match.index}`} className="ml-0.5">
          <button
            onClick={() => onCitationClick(citationIds[0])}
            className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
            title={`View study: ${citationIds.map(id => studyMap.get(id)?.title || id).join(', ')}`}
          >
            [{citationNumbers.join(',')}]
          </button>
        </sup>
      )
      
      lastIndex = match.index + match[0].length
    }
    
    // Add remaining text
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

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: Date.now().toString(),
          role: 'model',
          text: `Hello! I am MedChronos AI. I can help you discuss ${patientName ? patientName + "'s" : "this patient's"} medical information, including study summaries and the latest report. How can I assist you today?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ])
    }
  }, [isOpen, messages.length, patientName])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: inputValue.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    setMessages((prevMessages) => [...prevMessages, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      // Prepare messages for the API (role and parts structure)
      const apiMessages = [...messages, userMessage].map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }));
      
      // The last message sent to API should be the current user message
      // So, the history sent to API should be the current `messages` state,
      // and the new user message is part of the current query.
      // The API route is designed to take the full history and extract the last user message.

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, messages: apiMessages }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get response from AI')
      }

      const data = await response.json()
      const modelMessage: Message = {
        id: (Date.now() + 1).toString(), // Ensure unique ID
        role: 'model',
        text: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      setMessages((prevMessages) => [...prevMessages, modelMessage])
    } catch (error) {
      console.error('Chat API error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: error instanceof Error ? error.message : 'Sorry, something went wrong. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      setMessages((prevMessages) => [...prevMessages, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-xl flex flex-col z-50 border-l border-gray-200">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex justify-between items-center">
        <div className="flex items-center">
          <MessageCircle size={24} className="mr-2" />
          <h2 className="text-lg font-semibold">Chat with Patient Report</h2>
        </div>
        <button onClick={onClose} className="text-white hover:text-gray-200">
          <X size={24} />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-grow p-4 overflow-y-auto space-y-4 bg-gray-50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] p-3 rounded-lg shadow ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white rounded-br-none'
                  : 'bg-gray-200 text-gray-800 rounded-bl-none'
              }`}
            >
              {msg.role === 'model' ? (
                // Process citations for model messages
                <div className="prose prose-sm max-w-none text-gray-800">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }: any) => {
                        // Process text nodes for citations
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
                        // Process text nodes for citations in list items
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
                      },
                    }}
                  >
                    {msg.text}
                  </ReactMarkdown>
                </div>
              ) : (
                // Regular rendering for user messages
                <div className="prose prose-sm max-w-none text-white">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.text}
                  </ReactMarkdown>
                </div>
              )}
              <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-blue-200 text-right' : 'text-gray-500 text-left'}`}>
                {msg.timestamp}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] p-3 rounded-lg shadow bg-gray-200 text-gray-800 rounded-bl-none flex items-center">
              <Loader2 size={20} className="animate-spin mr-2 text-gray-500" />
              <span className="text-sm text-gray-500">MedChronos AI is typing...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 bg-white">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about the patient report..."
            className="flex-grow p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 flex items-center justify-center w-10 h-10"
            disabled={isLoading || !inputValue.trim()}
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </div>
      </form>
    </div>
  )
}

export default PatientChat
