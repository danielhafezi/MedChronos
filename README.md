# MedChronos Backend

Medical imaging timeline and AI-powered insights backend built with Next.js, Prisma, and Google Cloud Services.

## Backend Setup Complete ✅

### Infrastructure
- **Database**: Cloud SQL PostgreSQL (connected)
- **Storage**: Google Cloud Storage bucket configured
- **AI Models**: 
  - MedGemma 4B (image captioning)
  - MedGemma 27B (text summarization)
  - Gemini 2.5 Pro (holistic reports)

### API Endpoints

#### Health Check
```bash
GET /api/health
```
Returns system status and configuration check.

#### Patients
```bash
# List recent patients
GET /api/patients

# Create new patient
POST /api/patients
Body: {
  "name": "John Doe",
  "age": 65,
  "sex": "M",  // M, F, or Other
  "mrn": "12345",  // optional
  "reasonForImaging": "chest pain"  // optional
}

# Get patient with studies
GET /api/patients/{id}

# Delete patient (cascade deletes all data)
DELETE /api/patients/{id}
```

#### Studies
```bash
# Upload and process study
POST /api/studies
Content-Type: multipart/form-data
Fields:
  - patientId: UUID
  - title: string
  - modality: string (optional)
  - imagingDatetime: ISO date string
  - file0, file1, ...: image files
```

#### Reports
```bash
# Generate holistic report
POST /api/reports/generate
Body: {
  "patientId": "uuid",
  "includeCodes": false  // optional, for ICD-10/SNOMED codes
}
```

## Architecture

### Processing Pipeline
1. **Image Upload** → Sharp processing (896x896 JPEG)
2. **MedGemma 4B** → Individual slice captions
3. **MedGemma 27B** → Series-level summary
4. **Gemini 2.5 Pro** → Holistic patient report

### File Structure
```
lib/
  ai/
    medgemma.ts    # Vertex AI integration
    gemini.ts      # Gemini API integration
  db/
    client.ts      # Prisma client
  storage/
    gcs.ts         # Google Cloud Storage
  utils/
    image-processing.ts  # Sharp image processing
app/
  api/
    patients/      # Patient CRUD
    studies/       # Study upload & processing
    reports/       # Report generation
    health/        # Health check
```

## Running Locally

```bash
# Development server (already running)
npm run dev

# Database commands
npm run db:push     # Push schema changes
npm run db:migrate  # Run migrations
npm run db:studio   # Open Prisma Studio
```

## Environment Variables

All required environment variables are configured in `.env`:
- Database connection
- GCP credentials and project
- Vertex AI endpoints
- Gemini API key

## Testing the API

```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Create a patient
curl -X POST http://localhost:3000/api/patients \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Patient","age":45,"sex":"M"}'
```

## Next Steps

The backend is fully functional and ready for:
1. Frontend development
2. Integration testing
3. Performance optimization
4. Deployment to Cloud Run

## Performance Targets

- Study upload: < 30s (per PRD)
- Report generation: < 60s
- Image processing: ~200-500kb files

## Security Notes

- Service account key is gitignored
- Database uses SSL
- GCS buckets are private
- API endpoints validate inputs
