'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Upload, FileText, Calendar, Trash2, Edit2, Check, X, Image as ImageIcon } from 'lucide-react'
import ReportDisplay from '@/app/components/ReportDisplay'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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
  enhancedCaption?: string | null
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [studyToDelete, setStudyToDelete] = useState<Study | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingStudy, setEditingStudy] = useState<Study | null>(null)
  const [editForm, setEditForm] = useState({
    title: '',
    modality: '',
    imagingDatetime: ''
  })
  const [selectedImage, setSelectedImage] = useState<Image | null>(null)
  const [imageLoadError, setImageLoadError] = useState(false)

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    title: '',
    modality: '',
    imagingDatetime: new Date().toISOString().slice(0, 16),
    files: [] as File[],
    autoGenerateTitle: false,
    autoExtractDate: false,
    autoExtractModality: false
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
      formData.append('autoGenerateTitle', uploadForm.autoGenerateTitle.toString())
      formData.append('autoExtractDate', uploadForm.autoExtractDate.toString())
      formData.append('autoExtractModality', uploadForm.autoExtractModality.toString())
      
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
          files: [],
          autoGenerateTitle: false,
          autoExtractDate: false,
          autoExtractModality: false
        })
        setUploadProgress('')
        fetchPatient()
      } else {
        const errorData = await response.json()
        if (errorData.requiresManualDate) {
          setUploadProgress('Could not extract date from image. Please enter the date manually.')
          setUploadForm({ ...uploadForm, autoExtractDate: false })
        } else {
          setUploadProgress(errorData.error || 'Upload failed. Please try again.')
        }
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

  const handleStartEdit = (study: Study) => {
    setEditingStudy(study)
    setEditForm({
      title: study.title,
      modality: study.modality || '',
      imagingDatetime: new Date(study.imagingDatetime).toISOString().slice(0, 16)
    })
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    if (!editingStudy) return

    try {
      const updateData: any = {}
      
      // Only include fields that have changed
      if (editForm.title !== editingStudy.title) {
        updateData.title = editForm.title
      }
      if (editForm.modality !== (editingStudy.modality || '')) {
        updateData.modality = editForm.modality
      }
      const newDatetime = new Date(editForm.imagingDatetime).toISOString()
      const oldDatetime = new Date(editingStudy.imagingDatetime).toISOString()
      if (newDatetime !== oldDatetime) {
        updateData.imagingDatetime = editForm.imagingDatetime
      }

      // Only make API call if there are changes
      if (Object.keys(updateData).length > 0) {
        const response = await fetch(`/api/studies/${editingStudy.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData)
        })

        if (response.ok) {
          fetchPatient()
          setShowEditModal(false)
          setEditingStudy(null)
        }
      } else {
        // No changes, just close modal
        setShowEditModal(false)
        setEditingStudy(null)
      }
    } catch (error) {
      console.error('Error updating study:', error)
    }
  }

  const handleCancelEdit = () => {
    setShowEditModal(false)
    setEditingStudy(null)
  }

  const handleDeleteStudy = async (study: Study) => {
    setStudyToDelete(study)
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    if (!studyToDelete) return

    try {
      const response = await fetch(`/api/studies/${studyToDelete.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchPatient()
        setShowDeleteConfirm(false)
        setStudyToDelete(null)
      }
    } catch (error) {
      console.error('Error deleting study:', error)
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
                className="bg-white rounded-lg p-4 min-w-[300px] hover:shadow-md transition relative group"
              >
                {/* Edit/Delete buttons */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStartEdit(study)
                    }}
                    className="p-1.5 hover:bg-gray-100 rounded-lg"
                    title="Edit title"
                  >
                    <Edit2 className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteStudy(study)
                    }}
                    className="p-1.5 hover:bg-red-50 rounded-lg"
                    title="Delete study"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>

                <div 
                  className="cursor-pointer"
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
                  <div className="mt-3 text-sm text-gray-700 line-clamp-3">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc list-inside">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside">{children}</ol>,
                        li: ({ children }) => <li className="mb-0">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      }}
                    >
                      {study.seriesSummary}
                    </ReactMarkdown>
                  </div>
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
          <ReportDisplay report={latestReport} patient={patient} />
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
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Title/Caption *
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={uploadForm.autoGenerateTitle}
                        onChange={(e) => setUploadForm({ ...uploadForm, autoGenerateTitle: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-600">Auto-generate title</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    required={!uploadForm.autoGenerateTitle}
                    disabled={uploadForm.autoGenerateTitle}
                    value={uploadForm.title}
                    onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                    placeholder={uploadForm.autoGenerateTitle ? "Title will be generated based on image content" : "e.g., Chest CT with contrast"}
                  />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Modality (Optional)
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={uploadForm.autoExtractModality}
                        onChange={(e) => setUploadForm({ ...uploadForm, autoExtractModality: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-600">Auto-detect modality</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    disabled={uploadForm.autoExtractModality}
                    value={uploadForm.modality}
                    onChange={(e) => setUploadForm({ ...uploadForm, modality: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                    placeholder={uploadForm.autoExtractModality ? "Modality will be detected from image" : "e.g., CT, MRI, X-Ray"}
                  />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Imaging Date/Time *
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={uploadForm.autoExtractDate}
                        onChange={(e) => setUploadForm({ ...uploadForm, autoExtractDate: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-600">Auto-extract date</span>
                    </label>
                  </div>
                  <input
                    type="datetime-local"
                    required={!uploadForm.autoExtractDate}
                    disabled={uploadForm.autoExtractDate}
                    value={uploadForm.imagingDatetime}
                    onChange={(e) => setUploadForm({ ...uploadForm, imagingDatetime: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                    placeholder={uploadForm.autoExtractDate ? "Date will be extracted from image" : ""}
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
              <div className="text-gray-700">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="mb-2">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                    li: ({ children }) => <li className="mb-1">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  }}
                >
                  {selectedStudy.seriesSummary}
                </ReactMarkdown>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Images & Captions</h3>
              <div className="space-y-3">
                {selectedStudy.images.map((image) => (
                  <div 
                    key={image.id} 
                    className="border rounded-lg p-4 hover:shadow-md transition cursor-pointer"
                    onClick={() => {
                      setImageLoadError(false)
                      setSelectedImage(image)
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 mb-2">
                          Slice {image.sliceIndex + 1}
                        </p>
                        <p className="text-sm text-gray-700">
                          {image.enhancedCaption || image.sliceCaption}
                        </p>
                      </div>
                      <div className="ml-4 flex-shrink-0">
                        <div className="bg-gray-100 p-2 rounded-lg hover:bg-gray-200 transition">
                          <ImageIcon className="w-5 h-5 text-gray-600" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && studyToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-semibold mb-4">Delete Study</h2>
            <p className="text-gray-600 mb-2">
              Are you sure you want to delete this study?
            </p>
            <p className="text-gray-800 font-medium mb-6">
              "{studyToDelete.title}"
            </p>
            <p className="text-sm text-red-600 mb-6">
              This action cannot be undone. All associated images will be permanently deleted.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setStudyToDelete(null)
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Study Modal */}
      {showEditModal && editingStudy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-semibold mb-4">Edit Study</h2>
            
            <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(); }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Chest CT with contrast"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modality
                  </label>
                  <input
                    type="text"
                    value={editForm.modality}
                    onChange={(e) => setEditForm({ ...editForm, modality: e.target.value })}
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
                    value={editForm.imagingDatetime}
                    onChange={(e) => setEditForm({ ...editForm, imagingDatetime: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50">
          <div className="relative max-w-6xl w-full max-h-[90vh] flex flex-col">
            <div className="bg-white rounded-t-lg p-4 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold">Slice {selectedImage.sliceIndex + 1}</h3>
                <p className="text-sm text-gray-600">Medical Image Viewer</p>
              </div>
              <button
                onClick={() => setSelectedImage(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                ✕
              </button>
            </div>
            
            <div className="bg-black flex-1 flex items-center justify-center overflow-hidden">
              {imageLoadError ? (
                <div className="text-white text-center">
                  <div className="mb-4">
                    <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                  </div>
                  <p>Unable to load medical image</p>
                  <p className="text-sm text-gray-400 mt-2">The image may require authentication or the URL may be invalid</p>
                  <p className="text-xs text-gray-500 mt-4 break-all max-w-md mx-auto">URL: {selectedImage.gcsUrl}</p>
                </div>
              ) : (
                <img
                  src={selectedImage.gcsUrl}
                  alt={`Medical image slice ${selectedImage.sliceIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    console.error('Failed to load image:', selectedImage.gcsUrl)
                    setImageLoadError(true)
                  }}
                  onLoad={() => setImageLoadError(false)}
                />
              )}
            </div>
            
            <div className="bg-white rounded-b-lg p-4">
              <h4 className="font-medium mb-2">Enhanced Caption</h4>
              <p className="text-sm text-gray-700 mb-4">
                {selectedImage.enhancedCaption || selectedImage.sliceCaption}
              </p>
              
              <details className="text-sm">
                <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                  View Original Caption
                </summary>
                <p className="mt-2 text-gray-600">
                  {selectedImage.sliceCaption}
                </p>
              </details>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
