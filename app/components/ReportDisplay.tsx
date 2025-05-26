'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FileText, CheckCircle, AlertCircle, ChevronRight, Calendar, User, FileSearch } from 'lucide-react'

interface ReportDisplayProps {
  report: {
    geminiJson: {
      findings: string
      impression: string
      next_steps: string
    }
    createdAt: string
  }
  patient: {
    name: string
    age: number
    sex: string
    mrn: string | null
  }
}

export default function ReportDisplay({ report, patient }: ReportDisplayProps) {
  // Format the content with markdown
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

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Report Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="w-8 h-8" />
          <h2 className="text-2xl font-bold">Medical Imaging Report</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
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
      <div className="p-6 space-y-8">
        {/* Findings Section */}
        <div className="border-l-4 border-blue-500 pl-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-100 p-2 rounded-lg">
              <FileSearch className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Findings</h3>
          </div>
          <div className="prose prose-gray max-w-none">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({children}) => <p className="text-gray-700 leading-relaxed mb-3">{children}</p>,
                ul: ({children}) => <ul className="list-disc pl-5 space-y-2 text-gray-700">{children}</ul>,
                ol: ({children}) => <ol className="list-decimal pl-5 space-y-2 text-gray-700">{children}</ol>,
                li: ({children}) => <li className="leading-relaxed">{children}</li>,
                strong: ({children}) => <strong className="font-semibold text-gray-900">{children}</strong>,
              }}
            >
              {formatContent(report.geminiJson.findings)}
            </ReactMarkdown>
          </div>
        </div>

        {/* Impression Section */}
        <div className="border-l-4 border-green-500 pl-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-green-100 p-2 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Impression</h3>
          </div>
          <div className="prose prose-gray max-w-none">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({children}) => <p className="text-gray-700 leading-relaxed mb-3">{children}</p>,
                ul: ({children}) => <ul className="list-disc pl-5 space-y-2 text-gray-700">{children}</ul>,
                ol: ({children}) => <ol className="list-decimal pl-5 space-y-2 text-gray-700">{children}</ol>,
                li: ({children}) => <li className="leading-relaxed">{children}</li>,
                strong: ({children}) => <strong className="font-semibold text-gray-900">{children}</strong>,
              }}
            >
              {formatContent(report.geminiJson.impression)}
            </ReactMarkdown>
          </div>
        </div>

        {/* Next Steps Section */}
        <div className="border-l-4 border-orange-500 pl-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-orange-100 p-2 rounded-lg">
              <ChevronRight className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Next Steps</h3>
          </div>
          <div className="prose prose-gray max-w-none">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({children}) => <p className="text-gray-700 leading-relaxed mb-3">{children}</p>,
                ul: ({children}) => <ul className="list-disc pl-5 space-y-2 text-gray-700">{children}</ul>,
                ol: ({children}) => <ol className="list-decimal pl-5 space-y-2 text-gray-700">{children}</ol>,
                li: ({children}) => <li className="leading-relaxed">{children}</li>,
                strong: ({children}) => <strong className="font-semibold text-gray-900">{children}</strong>,
                em: ({children}) => <em className="italic text-gray-600">{children}</em>,
              }}
            >
              {formatContent(report.geminiJson.next_steps)}
            </ReactMarkdown>
          </div>
        </div>

        {/* Recommendations Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Clinical Correlation Required</p>
              <p>This AI-generated report should be reviewed in conjunction with clinical findings and patient history. Final diagnosis and treatment decisions should be made by qualified healthcare professionals.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
