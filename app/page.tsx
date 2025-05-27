'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Trash2, Eye, FileText, Stethoscope } from 'lucide-react'
import Breadcrumb from './components/Breadcrumb'

interface Patient {
  id: string
  name: string
  age: number
  sex: string
  mrn: string | null
  reasonForImaging: string | null
  createdAt: string
  _count?: {
    studies: number
    reports: number
  }
}

export default function Dashboard() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [showNewPatientModal, setShowNewPatientModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Form state for new patient
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    sex: 'M',
    mrn: '',
    reasonForImaging: ''
  })

  // Fetch patients on mount
  useEffect(() => {
    fetchPatients()
  }, [])

  const fetchPatients = async () => {
    try {
      const response = await fetch('/api/patients')
      const data = await response.json()
      setPatients(data)
    } catch (error) {
      console.error('Error fetching patients:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          age: parseInt(formData.age)
        })
      })

      if (response.ok) {
        setShowNewPatientModal(false)
        setFormData({
          name: '',
          age: '',
          sex: 'M',
          mrn: '',
          reasonForImaging: ''
        })
        fetchPatients()
      }
    } catch (error) {
      console.error('Error creating patient:', error)
    }
  }

  const handleDeletePatient = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete patient ${name}? This will delete all associated data.`)) {
      try {
        const response = await fetch(`/api/patients/${id}`, {
          method: 'DELETE'
        })
        
        if (response.ok) {
          fetchPatients()
        }
      } catch (error) {
        console.error('Error deleting patient:', error)
      }
    }
  }

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (patient.mrn && patient.mrn.includes(searchTerm))
  )

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">MedChronos</h1>
          <p className="text-sm text-gray-600">Medical Imaging Timeline & AI Insights</p>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <Breadcrumb 
          items={[{ label: 'Dashboard' }]} 
          className="mb-6"
        />
        {/* Controls */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => setShowNewPatientModal(true)}
            className="flex items-center gap-2 bg-medical-primary text-white px-4 py-2 rounded-lg hover:bg-medical-primary-dark transition"
          >
            <Plus className="w-5 h-5" />
            New Patient
          </button>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search patients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-medical-primary"
            />
          </div>
        </div>

        {/* Recent Patients */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Patients</h2>
          
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : filteredPatients.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? 'No patients found matching your search.' : 'No patients yet. Create your first patient!'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPatients.map((patient) => (
                <div key={patient.id} className="bg-white rounded-lg shadow p-4 hover:shadow-md transition">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">{patient.name}</h3>
                      <p className="text-sm text-gray-600">
                        {patient.age} years • {patient.sex === 'M' ? 'Male' : patient.sex === 'F' ? 'Female' : 'Other'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`/patients/${patient.id}`}
                        className="text-blue-600 hover:text-blue-800"
                        title="View patient"
                      >
                        <Eye className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handleDeletePatient(patient.id, patient.name)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete patient"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {patient.mrn && (
                    <p className="text-sm text-gray-500">MRN: {patient.mrn}</p>
                  )}
                  
                  {patient.reasonForImaging && (
                    <p className="text-sm text-gray-600 mt-1">
                      Reason: {patient.reasonForImaging}
                    </p>
                  )}
                  
                  <div className="flex gap-4 mt-3 text-sm text-medical-neutral-600">
                    <div className="flex items-center gap-1">
                      <Stethoscope className="w-4 h-4" />
                      <span>{patient._count?.studies || 0} studies</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      <span>{patient._count?.reports || 0} reports</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Patient Modal */}
      {showNewPatientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-semibold mb-4">Add New Patient</h2>
            
            <form onSubmit={handleCreatePatient}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Age *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="150"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sex *
                    </label>
                    <select
                      value={formData.sex}
                      onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    MRN (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.mrn}
                    onChange={(e) => setFormData({ ...formData, mrn: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for Imaging (Optional)
                  </label>
                  <textarea
                    value={formData.reasonForImaging}
                    onChange={(e) => setFormData({ ...formData, reasonForImaging: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowNewPatientModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Patient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
