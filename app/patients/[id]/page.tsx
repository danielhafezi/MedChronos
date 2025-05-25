'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Upload, FileText, Calendar, Trash2 } from 'lucide-react'

interface Patient {
  id: string
  name: string
  age: number
  sex: string
  mrn: string | null
  reasonForImaging: string | null
  studies: Study[]
  reports: Report[]
}

interface Study {
  id: string
  title: string
  modality: string | null
  imagingDatetime: string
  seriesSummary: string
  images: Image[]
}

interface Image {
  id: string
  gcsUrl: string
  sliceIndex: number
  sliceCaption: string
}

interface Report {
  id: string
  geminiJson: any
  createdAt: string
}

export default function PatientPage() {
  const params = useParams()
  const router = useRouter()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [selectedStudy, setSelectedStudy] = useState<Study | null>(null)
  const [uploadProgress, setUploadProgress] = useState('')
  const [generatingReport, setGeneratingReport] = useState(false)

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    title: '',
    modality: '',
    imagingDatetime: new Date().toISOString().slice(0, 16),
    files: [] as File[]
  })

  useEffect(() => {
    fetchPatient()
  }, [params.id])

  const fetchPatient = async () => {
    try {
      const response = await fetch(`/api/patients/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setPatient(data)
      }
    } catch (error) {
      console.error('Error fetching patient:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUploadStudy = async (e: React.FormEvent) => {
    e.preventDefault()
    setUploadProgress('Uploading images...')

    try {
      const formData = new FormData()
      formData.append('patientId', params.id as string)
      formData.append('title', uploadForm.title)
      formData.append('modality', uploadForm.modality)
      formData.append('imagingDatetime', uploadForm.imagingDatetime)
      
      uploadForm.files.forEach((file, index) => {
        formData.append(`file${index}`, file)
      })

      setUploadProgress('Processing images with AI...')
      
      const response = await fetch('/api/studies', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        setShowUploadModal(false)
        setUploadForm({
          title: '',
          modality: '',
          imagingDatetime: new Date().toISOString().slice(0, 16),
          files: []
        })
        setUploadProgress('')
        fetchPatient()
      } else {
        setUploadProgress('Upload failed. Please try again.')
      }
    } catch (error) {
      console.error('Error uploading study:', error)
      setUploadProgress('Upload failed. Please try again.')
    }
  }

  const handleGenerateReport = async () => {
    setGeneratingReport(true)
    
    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          patientId: params.id,
          includeCodes: false
        })
      })

      if (response.ok) {
        fetchPatient()
        setShowReportModal(false)
      }
    } catch (error) {
      console.error('Error generating report:', error)
    } finally {
      setGeneratingReport(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadForm({
        ...uploadForm,
        files: Array.from(e.target.files)
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Patient not found</div>
      </div>
    )
  }

  const latestReport = patient.reports[0]

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{patient.name}</h1>
              <p className="text-sm text-gray-600">
                {patient.age} years • {patient.sex === 'M' ? 'Male' : patient.sex === 'F' ? 'Female' : 'Other'}
                {patient.mrn && ` • MRN: ${patient.mrn}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-3">
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Upload className="w-4 h-4" />
            Upload Imaging
          </button>
          <button
            onClick={() => setShowReportModal(true)}
            disabled={patient.studies.length === 0}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
          >
            <FileText className="w-4 h-4" />
            Generate Report
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <h2 className="text-lg font-semibold mb-4">Imaging Timeline</h2>
        
        {patient.studies.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center text-gray-500">
            No imaging studies yet. Upload your first study to get started.
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {patient.studies.map((study) => (
              <div
                key={study.id}
                className="bg-white rounded-lg p-4 min-w-[300px] cursor-pointer hover:shadow-md transition"
                onClick={() => setSelectedStudy(study)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">
                    {new Date(study.imagingDatetime).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="font-semibold">{study.title}</h3>
                {study.modality && (
                  <p className="text-sm text-gray-500">{study.modality}</p>
                )}
                <p className="text-sm text-gray-600 mt-2">{study.images.length} images</p>
                <div className="mt-3 text-sm text-gray-700">
                  <p className="line-clamp-3">{study.seriesSummary}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Latest Report */}
      {latestReport && (
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h2 className="text-lg font-semibold mb-4">Latest Report</h2>
          <div className="bg-white rounded-lg p-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900">Findings</h3>
                <p className="text-gray-700 mt-1">{latestReport.geminiJson.findings}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Impression</h3>
                <p className="text-gray-700 mt-1">{latestReport.geminiJson.impression}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Next Steps</h3>
                <p className="text-gray-700 mt-1">{latestReport.geminiJson.next_steps}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-semibold mb-4">Upload Imaging Study</h2>
            
            <form onSubmit={handleUploadStudy}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title/Caption *
                  </label>
                  <input
                    type="text"
                    required
                    value={uploadForm.title}
                    onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Chest CT with contrast"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modality (Optional)
                  </label>
                  <input
                    type="text"
                    value={uploadForm.modality}
                    onChange={(e) => setUploadForm({ ...uploadForm, modality: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., CT, MRI, X-Ray"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Imaging Date/Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={uploadForm.imagingDatetime}
                    onChange={(e) => setUploadForm({ ...uploadForm, imagingDatetime: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Images *
                  </label>
                  <input
                    type="file"
                    multiple
                    required
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {uploadForm.files.length > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      {uploadForm.files.length} file(s) selected
                    </p>
                  )}
                </div>
              </div>
              
              {uploadProgress && (
                <div className="mt-4 text-sm text-blue-600">
                  {uploadProgress}
                </div>
              )}
              
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false)
                    setUploadProgress('')
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!!uploadProgress}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  Process
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-semibold mb-4">Generate Report</h2>
            <p className="text-gray-600 mb-6">
              Generate a comprehensive AI-powered report based on all imaging studies for this patient.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowReportModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateReport}
                disabled={generatingReport}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                {generatingReport ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Study Detail Modal */}
      {selectedStudy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-semibold">{selectedStudy.title}</h2>
                <p className="text-gray-600">
                  {new Date(selectedStudy.imagingDatetime).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedStudy(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Study Summary</h3>
              <p className="text-gray-700">{selectedStudy.seriesSummary}</p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Image Captions</h3>
              <div className="space-y-2">
                {selectedStudy.images.map((image) => (
                  <div key={image.id} className="border rounded-lg p-3">
                    <p className="text-sm font-medium text-gray-900">
                      Slice {image.sliceIndex + 1}
                    </p>
                    <p className="text-sm text-gray-700 mt-1">{image.sliceCaption}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
