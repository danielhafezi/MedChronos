'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Upload, FileText, Calendar, Trash2, Edit2, Check, X, Image as ImageIcon, ZoomIn, ZoomOut, RotateCw, RefreshCw, Sparkles, Monitor, Brain, Zap, Waves, Stethoscope, Clock, MapPin, Download } from 'lucide-react' // Added Download, Sparkles; removed MessageSquareText
import ReportDisplay from '@/app/components/ReportDisplay'
import PatientChat from '@/app/components/PatientChat' // Import PatientChat
import Breadcrumb from '@/app/components/Breadcrumb'
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch'
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
  signedUrl: string // Changed from publicUrl to signedUrl
  sliceIndex: number
  sliceCaption: string
  enhancedCaption?: string | null
}

interface Report {
  id: string
  geminiJson: any
  createdAt: string
}

// Utility function to get modality theme and icon
const getModalityTheme = (modality: string | null) => {
  const modalityLower = modality?.toLowerCase() || '';
  
  if (modalityLower.includes('ct')) {
    return {
      color: 'blue',
      icon: Monitor,
      bgClass: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
      iconClass: 'text-blue-600',
      badgeClass: 'bg-blue-100 text-blue-800',
      timelineClass: 'bg-blue-500'
    };
  } else if (modalityLower.includes('mri')) {
    return {
      color: 'purple',
      icon: Brain,
      bgClass: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
      iconClass: 'text-purple-600',
      badgeClass: 'bg-purple-100 text-purple-800',
      timelineClass: 'bg-purple-500'
    };
  } else if (modalityLower.includes('x-ray') || modalityLower.includes('xray')) {
    return {
      color: 'green',
      icon: Zap,
      bgClass: 'bg-green-50 border-green-200 hover:bg-green-100',
      iconClass: 'text-green-600',
      badgeClass: 'bg-green-100 text-green-800',
      timelineClass: 'bg-green-500'
    };
  } else if (modalityLower.includes('ultrasound') || modalityLower.includes('us')) {
    return {
      color: 'orange',
      icon: Waves,
      bgClass: 'bg-orange-50 border-orange-200 hover:bg-orange-100',
      iconClass: 'text-orange-600',
      badgeClass: 'bg-orange-100 text-orange-800',
      timelineClass: 'bg-orange-500'
    };
  } else {
    return {
      color: 'gray',
      icon: Stethoscope,
      bgClass: 'bg-gray-50 border-gray-200 hover:bg-gray-100',
      iconClass: 'text-gray-600',
      badgeClass: 'bg-gray-100 text-gray-800',
      timelineClass: 'bg-gray-500'
    };
  }
};

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
  const [rotation, setRotation] = useState(0)
  const transformComponentRef = useRef<any>(null)
  const [refreshingStudyId, setRefreshingStudyId] = useState<string | null>(null)
  const [refreshProgress, setRefreshProgress] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(false) // State for chat panel

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

      setUploadProgress('processing')
      
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
    if (e.target.files && e.target.files.length > 0) {
      setUploadForm(prevForm => ({
        ...prevForm,
        files: [...prevForm.files, ...Array.from(e.target.files as FileList)]
      }));
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setUploadForm(prevForm => ({
        ...prevForm,
        files: [...prevForm.files, ...Array.from(e.dataTransfer.files as FileList)]
      }));
      e.dataTransfer.clearData();
    }
    // Add visual feedback for drop area styling if needed
    const dropZone = e.currentTarget;
    dropZone.classList.remove('border-blue-500', 'bg-blue-50');
    dropZone.classList.add('border-gray-300');
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Add visual feedback for drop area styling if needed
    const dropZone = e.currentTarget;
    dropZone.classList.remove('border-gray-300');
    dropZone.classList.add('border-blue-500', 'bg-blue-50');

  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Add visual feedback for drop area styling if needed
    const dropZone = e.currentTarget;
    dropZone.classList.remove('border-blue-500', 'bg-blue-50');
    dropZone.classList.add('border-gray-300');
  };

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

  const handleRefreshStudy = async (study: Study) => {
    setRefreshingStudyId(study.id)
    setRefreshProgress('Regenerating image captions...')

    try {
      const response = await fetch(`/api/studies/${study.id}/refresh`, {
        method: 'POST'
      })

      if (response.ok) {
        const result = await response.json()
        setRefreshProgress('AI analysis complete!')
        
        // Refresh the patient data to show updated captions and summary
        await fetchPatient()
        
        // Update the selected study in the modal if it's currently open
        if (selectedStudy && selectedStudy.id === study.id) {
          const updatedPatient = await fetch(`/api/patients/${params.id}`).then(res => res.json())
          const updatedStudy = updatedPatient.studies.find((s: Study) => s.id === study.id)
          if (updatedStudy) {
            setSelectedStudy(updatedStudy)
          }
        }
        
        // Clear progress after a short delay
        setTimeout(() => {
          setRefreshProgress('')
        }, 2000)
      } else {
        const errorData = await response.json()
        setRefreshProgress(errorData.error || 'Failed to refresh study. Please try again.')
        
        // Clear error after delay
        setTimeout(() => {
          setRefreshProgress('')
        }, 5000)
      }
    } catch (error) {
      console.error('Error refreshing study:', error)
      setRefreshProgress('Failed to refresh study. Please try again.')
      
      // Clear error after delay
      setTimeout(() => {
        setRefreshProgress('')
      }, 5000)
    } finally {
      setRefreshingStudyId(null)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 animate-pulse">
        {/* Header Skeleton */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-gray-300 rounded-lg"></div> {/* Back button */}
              <div>
                <div className="h-6 bg-gray-300 rounded w-48 mb-1"></div> {/* Patient Name */}
                <div className="h-4 bg-gray-300 rounded w-32"></div> {/* Age/Sex/MRN */}
              </div>
            </div>
          </div>
        </div>

        {/* Breadcrumb Skeleton */}
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="h-4 bg-gray-300 rounded w-1/4 mb-4"></div>
        </div>
        
        {/* Sticky Actions Skeleton */}
        <div className="max-w-7xl mx-auto px-4 py-4 sticky top-0 bg-gray-50 z-40 shadow-sm">
          <div className="flex gap-3">
            <div className="h-10 bg-gray-300 rounded-lg w-40"></div> {/* Upload Imaging Button */}
          </div>
        </div>

        {/* Imaging Timeline Skeleton */}
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-4">
            <div className="h-6 bg-gray-300 rounded w-1/3"></div> {/* "Imaging Timeline" Title */}
            <div className="h-8 bg-gray-300 rounded-lg w-36"></div> {/* Generate Report Button */}
          </div>
          
          <div className="relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-300 z-0"></div> {/* Timeline Line */}
            <div className="flex gap-6 overflow-x-auto pb-4 relative z-10">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-gray-200 rounded-lg p-3 min-w-[240px] max-w-[280px] border-2 border-gray-300 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-gray-300 rounded-md"></div> {/* Icon */}
                      <div className="h-3 bg-gray-300 rounded w-20"></div> {/* Date */}
                    </div>
                    <div className="w-8 h-5 bg-gray-300 rounded-full"></div> {/* Image Count */}
                  </div>
                  <div className="mb-2">
                    <div className="h-4 bg-gray-300 rounded w-3/4 mb-1"></div> {/* Title line 1 */}
                    <div className="h-4 bg-gray-300 rounded w-1/2"></div>      {/* Title line 2 */}
                    <div className="h-3 bg-gray-300 rounded w-16 mt-1"></div> {/* Modality */}
                  </div>
                  <div className="space-y-1">
                    <div className="h-3 bg-gray-300 rounded w-full"></div>   {/* Summary line 1 */}
                    <div className="h-3 bg-gray-300 rounded w-5/6"></div>   {/* Summary line 2 */}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Latest Report Skeleton */}
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-4">
            <div className="h-6 bg-gray-300 rounded w-1/4"></div> {/* "Latest Report" Title */}
            <div className="h-8 bg-gray-300 rounded-lg w-40"></div> {/* Chat with Report Button */}
          </div>
          
          {/* ReportDisplay Skeleton - mimicking glassmorphism with grays */}
          <div className="bg-gray-200/50 backdrop-blur-md rounded-lg shadow-lg border border-gray-300/20 p-0.5"> {/* Outer container with slight transparency */}
            {/* Report Header Skeleton */}
            <div className="bg-gray-300/30 backdrop-blur-sm p-4 rounded-t-lg flex items-center gap-3 border-b border-gray-300/20">
              <div className="w-8 h-8 bg-gray-400/50 rounded-md p-1.5"></div> {/* Icon bg */}
              <div>
                <div className="h-5 bg-gray-400 rounded w-48 mb-1"></div> {/* Report Title */}
              </div>
            </div>

            {/* Report Summary Card Skeleton */}
            <div className="p-4 bg-gray-200/30 backdrop-blur-sm">
              <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div> {/* Summary Statement */}
              <div className="h-3 bg-gray-300 rounded w-1/2 mb-1"></div> {/* Key Metric 1 */}
              <div className="h-3 bg-gray-300 rounded w-1/3"></div>    {/* Key Metric 2 */}
            </div>
            
            {/* Report Content Area Skeleton */}
            <div className="p-4 space-y-4 bg-gray-200/20 backdrop-blur-sm">
              {/* Findings Section Skeleton */}
              <div className="bg-gray-300/20 backdrop-blur-sm rounded-lg p-3 border-l-4 border-gray-400">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 bg-gray-400/30 rounded"></div> {/* Icon */}
                  <div className="h-4 bg-gray-400 rounded w-20"></div> {/* Section Title */}
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-400 rounded w-full"></div>
                  <div className="h-3 bg-gray-400 rounded w-5/6"></div>
                  <div className="h-3 bg-gray-400 rounded w-4/6 flex items-center gap-1">
                     <span className="inline-block h-3 w-12 bg-gray-500/30 rounded-sm"></span> {/* Severity Tag */}
                  </div>
                </div>
              </div>
              
              {/* Impression Section Skeleton */}
              <div className="bg-gray-300/20 backdrop-blur-sm rounded-lg p-3 border-l-4 border-gray-400">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 bg-gray-400/30 rounded"></div> {/* Icon */}
                  <div className="h-4 bg-gray-400 rounded w-24"></div> {/* Section Title */}
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-400 rounded w-full"></div>
                  <div className="h-3 bg-gray-400 rounded w-3/4"></div>
                </div>
              </div>
              
              {/* Next Steps Section Skeleton */}
              <div className="bg-gray-300/20 backdrop-blur-sm rounded-lg p-3 border-l-4 border-gray-400">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 bg-gray-400/30 rounded"></div> {/* Icon */}
                  <div className="h-4 bg-gray-400 rounded w-28"></div> {/* Section Title */}
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-400 rounded w-5/6"></div>
                  <div className="h-3 bg-gray-400 rounded w-4/6"></div>
                </div>
              </div>
            </div>
            
            {/* Disclaimer Skeleton */}
            <div className="p-4 bg-gray-200/30 backdrop-blur-sm rounded-b-lg">
              <div className="bg-gray-300/20 p-3 rounded-lg border border-gray-400/20">
                <div className="h-3 bg-gray-400 rounded w-3/4 mb-1"></div>
                <div className="h-3 bg-gray-400 rounded w-full"></div>
              </div>
            </div>
          </div>
        </div>
      </main>
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

  const handleReportCitationClick = (studyId: string) => {
    const study = patient?.studies.find(s => s.id === studyId)
    if (study) {
      setSelectedStudy(study)
    }
  }

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

      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <Breadcrumb 
          items={[
            { label: patient.name } // Display patient name as the current page
          ]} 
          className="mb-4"
        />
      </div>

      {/* Actions */}
      <div className="max-w-7xl mx-auto px-4 py-4 sticky top-0 bg-gray-50 z-40 shadow-sm">
        <div className="flex gap-3">
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 bg-medical-primary text-white px-4 py-2 rounded-lg hover:bg-medical-primary-dark"
          >
            <Upload className="w-4 h-4" />
            Upload Imaging
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Imaging Timeline</h2>
          <button
            onClick={() => setShowReportModal(true)}
            disabled={patient.studies.length === 0}
            className="flex items-center gap-2 bg-[#c96442] text-white px-3 py-1.5 rounded-lg hover:bg-[#b05030] disabled:bg-medical-neutral-400"
          >
            <FileText className="w-4 h-4" />
            Generate Report
          </button>
        </div>
        
        {/* Refresh Progress Indicator */}
        {refreshProgress && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
              <span className="text-sm text-blue-700 font-medium">{refreshProgress}</span>
            </div>
          </div>
        )}
        
        {patient.studies.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center text-gray-500">
            No imaging studies yet. Upload your first study to get started.
          </div>
        ) : (
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute top-20 left-0 right-0 h-0.5 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 z-0"></div>
            
            <div className="flex gap-6 overflow-x-auto pb-4 relative z-10">
              {patient.studies.map((study, index) => {
                const theme = getModalityTheme(study.modality);
                const ModalityIcon = theme.icon;
                
                return (
                  <div key={study.id} className="relative flex-shrink-0">
                    
                    {/* Study Card */}
                    <div
                      id={`study-${study.id}`}
                      className={`${theme.bgClass} rounded-lg p-3 min-w-[240px] max-w-[280px] border-2 shadow-sm hover:shadow-md transition-all duration-200 relative group transform hover:-translate-y-1`}
                    >
                      {/* Edit/Delete buttons */}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStartEdit(study)
                          }}
                          className="p-1 hover:bg-white/50 rounded-md backdrop-blur-sm"
                          title="Edit study"
                        >
                          <Edit2 className="w-3 h-3 text-gray-600" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteStudy(study)
                          }}
                          className="p-1 hover:bg-red-50 rounded-md backdrop-blur-sm"
                          title="Delete study"
                        >
                          <Trash2 className="w-3 h-3 text-red-600" />
                        </button>
                      </div>

                      <div 
                        className="cursor-pointer"
                        onClick={() => setSelectedStudy(study)}
                      >
                        {/* Header with Icon and Date */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-md ${theme.iconClass} bg-white/50`}>
                              <ModalityIcon className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-gray-500" />
                                <span className="text-xs text-gray-600 font-medium">
                                  {new Date(study.imagingDatetime).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Image Count Badge */}
                          <div className={`${theme.badgeClass} px-1.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1`}>
                            <ImageIcon className="w-3 h-3" />
                            {study.images.length}
                          </div>
                        </div>
                        
                        {/* Title and Modality */}
                        <div className="mb-2">
                          <h3 className="font-semibold text-sm text-gray-900 mb-1 line-clamp-2">{study.title}</h3>
                          {study.modality && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-600 font-medium">{study.modality}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Study Summary */}
                        <div className="text-xs text-gray-700 line-clamp-2">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({ children }) => <p className="mb-0">{children}</p>,
                              ul: ({ children }) => <ul className="list-disc list-inside">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal list-inside">{children}</ol>,
                              li: ({ children }) => <li className="mb-0">{children}</li>,
                              strong: ({ children }) => <strong className="font-semibold">{children}</strong>
                            }}
                          >
                            {study.seriesSummary}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Latest Report */}
      {latestReport && (
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Latest Report</h2>
            <button
              onClick={() => setIsChatOpen(true)}
              disabled={!patient || patient.reports.length === 0}
              className="flex items-center gap-2 bg-medical-primary-light text-white px-3 py-1.5 rounded-lg hover:bg-medical-primary disabled:bg-medical-neutral-400"
            >
              <Sparkles className="w-4 h-4" />
              Chat with Report
            </button>
          </div>
          <ReportDisplay 
            report={latestReport} 
            patient={patient} 
            studies={patient.studies} 
            onCitationClick={handleReportCitationClick} 
          />
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
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
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md cursor-pointer hover:border-blue-400 transition-colors duration-150 ease-in-out"
                    onClick={() => document.getElementById('file-upload-input')?.click()}
                  >
                    <div className="space-y-1 text-center">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="flex text-sm text-gray-600">
                        <span className="relative bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                          Upload files
                        </span>
                        <input id="file-upload-input" name="file-upload" type="file" className="sr-only" multiple onChange={handleFileChange} accept="image/*" />
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500">
                        PNG, JPG, GIF up to 10MB each
                      </p>
                    </div>
                  </div>
                  {uploadForm.files.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-1">Selected files:</p>
                      <ul className="list-disc list-inside text-sm text-gray-600 max-h-32 overflow-y-auto">
                        {uploadForm.files.map((file, index) => (
                          <li key={index} className="truncate">
                            {file.name} ({ (file.size / 1024).toFixed(2) } KB)
                            <button
                              type="button"
                              onClick={() => {
                                setUploadForm(prev => ({
                                  ...prev,
                                  files: prev.files.filter((_, i) => i !== index)
                                }))
                              }}
                              className="ml-2 text-red-500 hover:text-red-700"
                              title="Remove file"
                            >
                              <Trash2 className="inline w-3 h-3" />
                            </button>
                          </li>
                        ))}
                      </ul>
                      <p className="text-sm text-gray-600 mt-1">
                        Total: {uploadForm.files.length} file(s) selected
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {uploadProgress && (
                <div className="mt-4">
                  {uploadProgress === 'processing' ? (
                    <div className="flex items-center justify-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                      <div className="flex flex-col items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                          <div className="absolute inset-0 w-10 h-10 border-4 border-transparent border-r-blue-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-blue-800">Processing with AI</p>
                          <p className="text-xs text-blue-600 mt-1">Analyzing medical images...</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-blue-600">
                      {uploadProgress}
                    </div>
                  )}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-semibold">{selectedStudy.title}</h2>
                <p className="text-gray-600">
                  {new Date(selectedStudy.imagingDatetime).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRefreshStudy(selectedStudy)}
                  disabled={refreshingStudyId === selectedStudy.id}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh AI captions and summary"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshingStudyId === selectedStudy.id ? 'animate-spin' : ''}`} />
                  {refreshingStudyId === selectedStudy.id ? 'Refreshing...' : ''}
                </button>
                <button
                  onClick={() => setSelectedStudy(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  ✕
                </button>
              </div>
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
              <div className="flex items-center gap-2">
                <button
                  title="Zoom In"
                  onClick={() => transformComponentRef.current?.zoomIn()}
                  className="p-2 hover:bg-gray-200 rounded-lg"
                >
                  <ZoomIn className="w-5 h-5 text-gray-700" />
                </button>
                <button
                  title="Zoom Out"
                  onClick={() => transformComponentRef.current?.zoomOut()}
                  className="p-2 hover:bg-gray-200 rounded-lg"
                >
                  <ZoomOut className="w-5 h-5 text-gray-700" />
                </button>
                <button
                  title="Rotate 90°"
                  onClick={() => setRotation((prev) => (prev + 90) % 360)}
                  className="p-2 hover:bg-gray-200 rounded-lg"
                >
                  <RotateCw className="w-5 h-5 text-gray-700" />
                </button>
                <button
                  title="Reset View"
                  onClick={() => {
                    transformComponentRef.current?.resetTransform()
                    setRotation(0)
                  }}
                  className="p-2 hover:bg-gray-200 rounded-lg"
                >
                  <RefreshCw className="w-5 h-5 text-gray-700" />
                </button>
                <button
                  onClick={() => {
                    setSelectedImage(null)
                    setRotation(0) // Reset rotation when closing
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  ✕
                </button>
              </div>
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
                  <p className="text-xs text-gray-500 mt-4 break-all max-w-md mx-auto">URL: {selectedImage.signedUrl}</p>
                </div>
              ) : (
                <TransformWrapper
                  ref={transformComponentRef}
                  initialScale={1}
                  initialPositionX={0}
                  initialPositionY={0}
                >
                  <TransformComponent
                    wrapperStyle={{ width: '100%', height: '100%' }}
                    contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <img
                      src={selectedImage.signedUrl}
                      alt={`Medical image slice ${selectedImage.sliceIndex + 1}`}
                      className="max-w-full max-h-full object-contain"
                      style={{ transform: `rotate(${rotation}deg)` }}
                      onError={(e) => {
                        console.error('Failed to load image:', selectedImage.signedUrl)
                        setImageLoadError(true)
                      }}
                      onLoad={() => setImageLoadError(false)}
                    />
                  </TransformComponent>
                </TransformWrapper>
              )}
            </div>
            
            <div className="bg-white rounded-b-lg p-4 max-h-[25vh] overflow-y-auto">
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

      {/* Chat Panel */}
      {patient && (
        <PatientChat
          patientId={patient.id}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          patientName={patient.name}
          studies={patient.studies}
          onCitationClick={handleReportCitationClick}
        />
      )}
    </main>
  )
}
