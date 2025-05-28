import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, Content } from '@google/generative-ai'
import type { PatientData, StudyData, ReportOutput } from '@/lib/ai/gemini';

const prisma = new PrismaClient()
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const proModel = genAI.getGenerativeModel({
  model: 'gemini-1.5-pro-latest', // Using 1.5 Pro for better streaming and context
  safetySettings: [
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
      select: { id: true, title: true, imagingDatetime: true, seriesSummary: true, modality: true },
    })

    // 3. Fetch Latest Report Data
    const reportRecord = await prisma.report.findFirst({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    })

    let reportOutput: ReportOutput | null = null;
    if (reportRecord && reportRecord.geminiJson) {
        reportOutput = reportRecord.geminiJson as unknown as ReportOutput;
    }
    
    // 4. Construct System Prompt
    let systemPrompt = `You are MedChronos AI, a helpful medical assistant. Your role is to discuss the patient's medical information based on the context provided below. While your primary knowledge comes from this context, you can engage in *reasoned discussion* about potential medical scenarios if the user presents new symptoms or queries not explicitly covered.

IMPORTANT: When referencing information from specific studies, you MUST include citations in the format [CITE:study_id]. For example, if referencing information from study with ID "abc123", write [CITE:abc123]. You can cite multiple studies like [CITE:study_id1,study_id2].

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
- Modality: ${study.modality || 'N/A'}
- Date: ${study.imagingDatetime.toLocaleDateString()}
- Summary: ${study.seriesSummary || 'No summary available.'}`
  )
  .join('\n')}

Latest Comprehensive Report (${reportOutput ? new Date(reportRecord!.createdAt).toLocaleDateString() : 'N/A'}):
${reportOutput 
  ? `Findings:\n${reportOutput.findings}\n\nImpression:\n${reportOutput.impression}\n\nNext Steps/Recommendations:\n${reportOutput.next_steps}`
  : 'No detailed report available.'
}
---
Based on this information, please answer the user's questions. Always cite the specific study IDs when referring to information from particular studies.

If a user asks about a symptom or condition not explicitly mentioned in the provided context:
1. First, clearly state that the symptom/condition is not directly mentioned in the available patient data.
2. Then, if appropriate, you MAY offer potential insights or correlations based on the *existing* patient information (e.g., "Given the patient's history of X [CITE:study_id_Y], one might consider Z as a possibility, though this new symptom is not documented.").
3. Frame these insights as *hypothetical possibilities for discussion* and NOT as a diagnosis.
4. ALWAYS conclude such discussions by strongly advising the user to consult with the patient's physician for any new, worsening, or unconfirmed symptoms, as you are an AI assistant and cannot provide medical diagnoses.

Your goal is to be helpful and informative within the bounds of a medical assistant AI, facilitating understanding of the provided data and aiding in formulating questions for healthcare professionals. Do not refuse to discuss hypothetical scenarios if the user prompts for them, but maintain appropriate disclaimers.
`
    // 5. Construct conversation history for Gemini
    const conversationHistory: Content[] = messages.slice(0, -1).map(msg => ({
      role: msg.role,
      parts: msg.parts.map(part => ({ text: part.text }))
    }));
    
    const currentUserMessageContent = messages[messages.length - 1].parts[0].text;

    let processedHistory = [...conversationHistory];
    if (processedHistory.length > 0 && processedHistory[0].role === 'model') {
      processedHistory.shift(); 
    }
    
    const chat = proModel.startChat({
        systemInstruction: {
          role: 'model', 
          parts: [{ text: systemPrompt }],
        },
        history: processedHistory,
      });
    
    const result = await chat.sendMessageStream(currentUserMessageContent);

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            controller.enqueue(new TextEncoder().encode(chunkText));
          }
        } catch (error) {
          console.error('Error during stream generation:', error);
          controller.error(error);
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

  } catch (error) {
    console.error('Error in chat API:', error)
    if (error instanceof Error && error.message.includes('SAFETY')) {
        return NextResponse.json({ error: 'Response blocked due to safety settings. Please rephrase your query.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to get response from AI model' }, { status: 500 })
  }
}
