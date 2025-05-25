export interface PatientWithStudies {
  id: string
  name: string
  age: number
  sex: string
  mrn: string | null
  reasonForImaging: string | null
  createdAt: Date
  studies: Array<{
    id: string
    patientId: string
    title: string
    modality: string | null
    imagingDatetime: Date
    seriesSummary: string
    includeCodes: boolean
    geminiJson: any
    createdAt: Date
  }>
}

export interface StudyWithImages {
  id: string
  patientId: string
  title: string
  modality: string | null
  imagingDatetime: Date
  seriesSummary: string
  includeCodes: boolean
  geminiJson: any
  createdAt: Date
  images: Array<{
    id: string
    studyId: string
    gcsUrl: string
    sliceIndex: number
    sliceCaption: string
    createdAt: Date
  }>
}
