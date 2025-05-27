import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import type { PatientData, StudyData, ReportOutput } from '@/lib/ai/gemini'; // Assuming these types are exported

const prisma = new PrismaClient()
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const proModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-pro-preview-05-06',
  safetySettings: [ // Add safety settings to reduce likelihood of blocked responses
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ],
})

interface ChatRequestBody {
  patientId: string
  messages: Array<{ role: 'user' | 'model'; parts: Array<{text: string}> }>
}

export async function POST(req: NextRequest) {
  try {
    const { patientId, messages } = (await req.json()) as ChatRequestBody

    if (!patientId || !messages || messages.length === 0) {
      return NextResponse.json({ error: 'Missing patientId or messages' }, { status: 400 })
    }

    // 1. Fetch Patient Data
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    })
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // 2. Fetch Studies Data
    const studies = await prisma.study.findMany({
      where: { patientId },
      orderBy: { imagingDatetime: 'asc' },
      select: { id: true, title: true, imagingDatetime: true, seriesSummary: true }, // Select only needed fields
    })

    // 3. Fetch Latest Report Data
    const reportRecord = await prisma.report.findFirst({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    })

    if (!reportRecord || !reportRecord.geminiJson) {
      return NextResponse.json({ error: 'Latest report not found for this patient' }, { status: 404 })
    }
    
    const reportOutput = reportRecord.geminiJson as unknown as ReportOutput;


    // 4. Construct System Prompt
    let systemPrompt = `You are MedChronos AI, a helpful medical assistant. Your role is to discuss the patient's medical information based *solely* on the context provided below. Do not infer, speculate, or provide medical advice beyond what is explicitly stated in the reports and summaries.

IMPORTANT: When referencing information from specific studies, you MUST include citations in the format [CITE:study_id]. For example, if referencing information from study with ID "abc123", write [CITE:abc123]. You can cite multiple studies like [CITE:study1_id,study2_id].

Patient Information:
- Name: ${patient.name}
- Age: ${patient.age}
- Sex: ${patient.sex}
- Reason for Imaging: ${patient.reasonForImaging || 'Not specified'}

Imaging Studies (in chronological order):
${studies
  .map(
    (study, index) => `
Study ${index + 1}:
- ID: ${study.id}
- Title: ${study.title}
- Date: ${study.imagingDatetime.toLocaleDateString()}
- Summary: ${study.seriesSummary}`
  )
  .join('\n')}

Latest Comprehensive Report:
Findings:
${reportOutput.findings}

Impression:
${reportOutput.impression}

Next Steps/Recommendations:
${reportOutput.next_steps}

---
Based on this information, please answer the user's questions. Always cite the specific study IDs when referring to information from particular studies. If the information is not available in the provided context, state that clearly.
`
    // 5. Construct conversation history for Gemini
    const conversationHistory = messages.slice(0, -1); // All messages except the last one (current user query)
    const currentUserMessageContent = messages[messages.length - 1].parts; // This is an array, e.g. [{text: "User query"}]

    // Ensure history for startChat is either empty or starts with a 'user' role.
    let processedHistory = [...conversationHistory]; // Work with a mutable copy

    // If the conversationHistory (which is messages from client MINUS the current user query)
    // is not empty and its first message is from the 'model' (our welcome message),
    // we remove it so the history passed to the SDK starts with a 'user' message or is empty.
    if (processedHistory.length > 0 && processedHistory[0].role === 'model') {
      processedHistory.shift(); // Removes the first element
    }
    // Now, processedHistory is suitable for the SDK:
    // - If original conversationHistory was [model_welcome], processedHistory is [].
    // - If original conversationHistory was [model_welcome, user_q1, model_a1], processedHistory is [user_q1, model_a1].
    // - If original conversationHistory was [user_q1, model_a1], processedHistory is [user_q1, model_a1].
    // - If original conversationHistory was [], processedHistory is [].
    
    const chat = proModel.startChat({
        systemInstruction: {
          role: 'model', // System instructions are often set as a model's initial turn or context
          parts: [{ text: systemPrompt }],
        },
        history: processedHistory, // Pass the processed history
        // generationConfig: { // Optional: configure temperature, topK, etc.
        //   maxOutputTokens: 2000,
        // },
      });
    
    // Send only the current user's message parts
    const result = await chat.sendMessage(currentUserMessageContent);
    const response = result.response;
    const text = response.text();

    return NextResponse.json({ reply: text })
  } catch (error) {
    console.error('Error in chat API:', error)
    if (error instanceof Error && error.message.includes('SAFETY')) {
        return NextResponse.json({ error: 'Response blocked due to safety settings. Please rephrase your query.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to get response from AI model' }, { status: 500 })
  }
}
