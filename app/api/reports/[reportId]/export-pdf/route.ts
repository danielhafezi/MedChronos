import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

export async function GET(
  request: Request,
  { params }: { params: { reportId: string } }
) {
  const { reportId } = params;

  if (!reportId) {
    return NextResponse.json({ error: 'Report ID is required' }, { status: 400 });
  }

  let browser;
  try {
    // Determine base URL (for local dev vs. production)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const printableUrl = `${appUrl}/reports/${reportId}/print`;

    // Launch Puppeteer
    // Added args for compatibility, especially in Docker/CI environments
    browser = await puppeteer.launch({
      headless: true, // Ensure it runs in headless mode
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Often needed in constrained environments
        '--font-render-hinting=none', // May help with font rendering issues
      ],
    });
    const page = await browser.newPage();

    // Navigate to the printable report page
    // waitUntil: 'networkidle0' waits for network activity to cease, good for SPAs
    await page.goto(printableUrl, { waitUntil: 'networkidle0', timeout: 60000 }); // 60s timeout

    // Optional: Wait for a specific element if networkidle0 is not enough
    // await page.waitForSelector('sel_ect_or_of_report_content_if_needed', { timeout: 30000 });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true, // Ensures backgrounds (like gradients) are printed
      margin: { // Optional margins
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px',
      },
    });

    // Create a NextResponse with the PDF buffer
    const response = new NextResponse(pdfBuffer);

    // Set headers for PDF download
    response.headers.set('Content-Type', 'application/pdf');
    response.headers.set(
      'Content-Disposition',
      `attachment; filename="MedChronos_Report_${reportId}.pdf"`
    );

    return response;
  } catch (error) {
    console.error(`Error generating PDF for report ${reportId}:`, error);
    if (browser) {
      await browser.close(); // Ensure browser is closed on error
    }
    return NextResponse.json({ error: 'Failed to generate PDF report' }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close(); // Ensure browser is closed in finally block
    }
  }
}
