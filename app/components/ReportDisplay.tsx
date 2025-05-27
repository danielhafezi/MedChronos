'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FileText, CheckCircle, AlertCircle, ChevronRight, Calendar, User, FileSearch, X, ImageIcon, ExternalLink } from 'lucide-react'

interface Study {
  id: string
  title: string
  modality: string | null
  imagingDatetime: string
  seriesSummary: string
}

interface ReportDisplayProps {
  report: {
    geminiJson: {
      findings: string
      impression: string
      next_steps: string
      citations?: { [key: string]: string }
    }
    createdAt: string
  }
  patient: {
    name: string
    age: number
    sex: string
    mrn: string | null
  }
  studies?: Study[]
  onCitationClick: (studyId: string) => void // New prop to handle citation clicks
}

export default function ReportDisplay({ report, patient, studies = [], onCitationClick }: ReportDisplayProps) {
  // Create a map of study IDs to study objects for easy lookup
  const studyMap = new Map<string, Study>()
  studies.forEach(study => {
    studyMap.set(study.id, study)
  })

  // Create a map of citation references to study IDs
  const citationMap = report.geminiJson.citations || {}
  
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
            onClick={() => onCitationClick(citationIds[0])} // Use the passed prop
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

  // Format the content with markdown and citations
  const formatContent = (content: string | null | undefined) => {
    // Handle null, undefined, or non-string content
    if (!content || typeof content !== 'string') {
      return 'No content available.'
    }
    
    // Add bullet points if not already present
    const lines = content.split(/(?=[A-Z])/g).filter(line => line.trim())
    if (lines.length > 1 && !content.includes('•') && !content.includes('-')) {
      return lines.map(line => `• ${line.trim()}`).join('\n')
    }
    return content
  }

  // Custom markdown components that handle citations
  const createMarkdownComponents = () => ({
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
      
      return <p className="text-gray-700 leading-relaxed mb-3">{processedChildren}</p>
    },
    ul: ({ children }: any) => <ul className="list-disc pl-5 space-y-2 text-gray-700">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal pl-5 space-y-2 text-gray-700">{children}</ol>,
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
      
      return <li className="leading-relaxed">{processedChildren}</li>
    },
    strong: ({ children }: any) => <strong className="font-semibold text-gray-900">{children}</strong>,
    em: ({ children }: any) => <em className="italic text-gray-600">{children}</em>,
  })

  return (
    <>
      <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-lg border border-white/20 overflow-hidden">
        {/* Report Header */}
        <div className="bg-gradient-to-r from-medical-primary/20 to-medical-primary-light/15 backdrop-blur-sm border-b border-medical-primary/10 text-medical-primary p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-white/30 backdrop-blur-sm p-2 rounded-lg border border-white/20">
              <FileText className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold">Medical Imaging Report</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm opacity-90">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>{patient.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{new Date(report.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <FileSearch className="w-4 h-4" />
              <span>{patient.age}y {patient.sex} {patient.mrn ? `• MRN: ${patient.mrn}` : ''}</span>
            </div>
          </div>
        </div>

        {/* Report Content */}
        <div className="p-6 space-y-8 bg-white/40 backdrop-blur-sm">
          {/* Findings Section */}
          <div className="border-l-4 border-medical-primary/40 pl-6 bg-white/30 backdrop-blur-sm rounded-r-lg p-4 border border-l-4 border-medical-primary/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-medical-primary/10 backdrop-blur-sm p-2 rounded-lg border border-medical-primary/20">
                <FileSearch className="w-6 h-6 text-medical-primary" />
              </div>
              <h3 className="text-xl font-bold text-medical-primary-dark">Findings</h3>
            </div>
            <div className="prose prose-gray max-w-none">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={createMarkdownComponents()}
              >
                {formatContent(report.geminiJson.findings)}
              </ReactMarkdown>
            </div>
          </div>

          {/* Impression Section */}
          <div className="border-l-4 border-medical-success/40 pl-6 bg-white/30 backdrop-blur-sm rounded-r-lg p-4 border border-l-4 border-medical-success/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-medical-success/10 backdrop-blur-sm p-2 rounded-lg border border-medical-success/20">
                <CheckCircle className="w-6 h-6 text-medical-success" />
              </div>
              <h3 className="text-xl font-bold text-medical-success-dark">Impression</h3>
            </div>
            <div className="prose prose-gray max-w-none">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={createMarkdownComponents()}
              >
                {formatContent(report.geminiJson.impression)}
              </ReactMarkdown>
            </div>
          </div>

          {/* Next Steps Section */}
          <div className="border-l-4 border-medical-warning/40 pl-6 bg-white/30 backdrop-blur-sm rounded-r-lg p-4 border border-l-4 border-medical-warning/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-medical-warning/10 backdrop-blur-sm p-2 rounded-lg border border-medical-warning/20">
                <ChevronRight className="w-6 h-6 text-medical-warning" />
              </div>
              <h3 className="text-xl font-bold text-medical-warning-dark">Next Steps</h3>
            </div>
            <div className="prose prose-gray max-w-none">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={createMarkdownComponents()}
              >
                {formatContent(report.geminiJson.next_steps)}
              </ReactMarkdown>
            </div>
          </div>

          {/* Recommendations Box */}
          <div className="mt-8 bg-medical-primary/5 backdrop-blur-sm border border-medical-primary/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-medical-primary mt-0.5" />
              <div className="text-sm text-medical-primary-dark">
                <p className="font-semibold mb-1">Clinical Correlation Required</p>
                <p>This AI-generated report should be reviewed in conjunction with clinical findings and patient history. Final diagnosis and treatment decisions should be made by qualified healthcare professionals.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
