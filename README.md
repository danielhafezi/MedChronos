# MedChronos: AI-Powered Medical Imaging Timeline

<p align="center">
  <img src="public/images/logo.png" alt="MedChronos Logo" width="150"/>
</p>

<p align="center">
  <strong>The first open-source, AI-driven platform for managing and analyzing patient medical imaging studies over time.</strong>
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <!-- Add other relevant badges here, e.g., build status, version -->
</p>

MedChronos revolutionizes how clinicians and researchers interact with patient imaging data. By providing a chronological timeline and leveraging cutting-edge AI, it offers unprecedented insights into patient health trajectories. This project is proudly open-source, aiming to foster innovation and collaboration in medical technology.

## Demo

<p align="center">
  <img src="public/images/medchronos.gif" alt="MedChronos Demo GIF" width="700"/>
</p>

## ✨ Key Features

MedChronos is packed with features designed to streamline workflows and enhance diagnostic capabilities:

*   **AI-Powered Insights**:
    *   **Automated Slice Captioning**: Gemini 2.5 Flash generates detailed captions for each image slice.
    *   **Per-Study Summaries**: Concise AI-generated summaries for entire imaging studies.
    *   **Holistic Patient Reports**: Gemini 2.5 Pro creates comprehensive reports analyzing trends across all studies, including:
        *   Detailed findings with [CITE:study_id] references.
        *   Clinical impressions.
        *   Actionable next steps and recommendations.
        *   Visual severity indicators for each finding.
        *   At-a-glance report summary cards with key metrics.
*   **Patient Management**:
    *   Full CRUD (Create, Read, Update, Delete) operations for patient records.
*   **Imaging Study Management**:
    *   **Versatile Uploads**: Supports multi-file DICOM and standard image formats (JPEG, PNG).
    *   **Automated Processing**: Images are standardized to 896x896 JPEG.
    *   **Intelligent Metadata Extraction**: AI automatically suggests study titles, extracts imaging dates, and detects modalities.
    *   **Timeline Visualization**: Intuitive horizontal scrolling timeline displaying studies chronologically.
    *   **Interactive Image Viewer**:
        *   Pan, zoom, and rotate capabilities for detailed image inspection.
        *   View AI-generated captions alongside images.
    *   **Study Editing & Deletion**: Full control over study metadata and records.
    *   **AI Refresh**: Re-analyze existing studies with the latest AI processing.
*   **Comprehensive Reporting**:
    *   Generate detailed medical reports on-demand.
    *   **PDF Export**: Easily export reports to PDF for sharing and archiving.
*   **AI-Powered Patient Chat**:
    *   Engage in intelligent, context-aware conversations about a patient's entire medical imaging history.
    *   Access patient demographics, all studies, summaries, and the latest report.
    *   Features streaming responses, chat history, and AI-generated chat titles.
*   **Modern & Intuitive UI/UX**:
    *   Clean, professional design with a clinical color palette.
    *   Easy navigation with breadcrumbs and a global header/footer.
    *   Resizable chat panel for user convenience.
    *   Favicon for brand consistency.
*   **Open Source**:
    *   **A pioneering effort**: Believed to be the first open-source platform of its kind dedicated to AI-powered patient imaging timeline management.
    *   Community-driven development and innovation.

## 🚀 Why MedChronos?

Managing and interpreting patient imaging studies over time is a complex and time-consuming task. MedChronos addresses these challenges by:

*   **Saving Time**: Automates the analysis of numerous images and reports.
*   **Enhancing Insights**: AI can identify subtle patterns and changes that might be missed.
*   **Improving Collaboration**: Standardized, shareable reports (including PDF).
*   **Facilitating Research**: Provides structured data and insights for medical research.
*   **Empowering Clinicians**: Offers a powerful tool for tracking disease progression and treatment efficacy.

Being **open-source**, MedChronos invites developers, clinicians, and researchers to contribute, adapt, and build upon this platform, pushing the boundaries of medical imaging technology.

## 🛠️ Technology Stack

*   **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
*   **Backend**: Next.js API Routes, Prisma ORM
*   **Database**: PostgreSQL (Google Cloud SQL)
*   **AI/ML**: Google Generative AI (Gemini 2.5 Pro, Gemini 2.5 Flash)
*   **Storage**: Google Cloud Storage
*   **Image Processing**: Sharp
*   **PDF Generation**: Puppeteer

## ⚙️ Getting Started

### Prerequisites
*   Node.js 18+
*   npm or yarn
*   Google Cloud SDK
*   Git

### Environment Variables
Create a `.env` file in the root directory and populate it with your credentials:
```env
# Database
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require

# Google Cloud
GOOGLE_APPLICATION_CREDENTIALS=./path-to-your-gcp-key.json
GCP_PROJECT_ID=your-gcp-project-id
GCS_BUCKET_NAME=your-gcs-bucket-name

# Vertex AI (Location might be needed for other Vertex services)
VERTEX_AI_LOCATION=us-central1 

# Gemini API
GEMINI_API_KEY=your-gemini-api-key
```

### Installation & Running Locally
1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/medchronos.git
    cd medchronos
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  If on Windows, install Sharp specifically:
    ```bash
    npm install --os=win32 --cpu=x64 sharp
    ```
4.  Push database schema changes (if it's the first time or schema changed):
    ```bash
    npm run db:push 
    # or npx prisma db push
    ```
5.  Run the development server:
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:3000`.

## 📖 Usage Overview

1.  **Create a Patient**: Navigate to the dashboard and add a new patient.
2.  **Upload Imaging Studies**: Go to the patient's detail page and upload DICOM or JPEG files. AI will automatically process them.
3.  **View Timeline & Images**: Explore studies chronologically. Click on a study to view details and individual images with AI captions. Use the interactive viewer to pan, zoom, and rotate.
4.  **Generate Reports**: Request an AI-generated holistic report based on all available studies for the patient.
5.  **Chat with AI**: Use the patient chat feature to ask questions and gain insights from the patient's data.
6.  **Export Reports**: Download comprehensive reports as PDF files.

## 🤝 Contributing

Contributions are welcome! Whether it's bug fixes, feature enhancements, or documentation improvements, please feel free to:
1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/YourFeature`).
3.  Make your changes.
4.  Commit your changes (`git commit -m 'Add some feature'`).
5.  Push to the branch (`git push origin feature/YourFeature`).
6.  Open a Pull Request.

Please ensure your code adheres to the project's coding standards and includes tests where applicable.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details (assuming MIT, you might need to create this file).

## 🙏 Acknowledgements

*   To all contributors and the open-source community.
*   Inspired by the need for better tools in medical imaging analysis.

---

We believe MedChronos has the potential to significantly impact medical imaging. Join us in making it even better!
