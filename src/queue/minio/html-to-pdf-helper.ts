/**
 * Helper để render HTML description với Puppeteer thành PDF buffer
 * Sau đó merge vào PDF chính
 */

// Dynamic import for puppeteer (optional dependency)
let puppeteer: any;

async function getPuppeteer() {
  if (!puppeteer) {
    try {
      puppeteer = await import('puppeteer');
      return puppeteer.default || puppeteer;
    } catch (error) {
      console.warn('Puppeteer is not installed. HTML description will use fallback text rendering.');
      return null;
    }
  }
  return puppeteer.default || puppeteer;
}

/**
 * Render HTML description thành PDF buffer với Puppeteer
 */
export async function renderHtmlDescriptionToPdf(html: string): Promise<Buffer | null> {
  if (!html || typeof html !== 'string') {
    return null;
  }

  const puppeteerLib = await getPuppeteer();
  if (!puppeteerLib) {
    return null; // Fallback to plain text
  }

  let browser;
  
  try {
    // Launch browser
    browser = await puppeteerLib.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'], // For Linux servers
    });

    const page = await browser.newPage();

    // Create HTML template for description
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4;
      margin: 2.54cm;
    }
    body {
      font-family: 'Times New Roman', 'Liberation Serif', serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #000;
      margin: 0;
      padding: 0;
    }
    
    /* TinyMCE content styles */
    h1 {
      font-size: 18pt;
      font-weight: bold;
      margin-top: 15px;
      margin-bottom: 10px;
    }
    
    h2 {
      font-size: 16pt;
      font-weight: bold;
      margin-top: 15px;
      margin-bottom: 10px;
    }
    
    h3 {
      font-size: 14pt;
      font-weight: bold;
      margin-top: 12px;
      margin-bottom: 8px;
    }
    
    h4, h5, h6 {
      font-size: 13pt;
      font-weight: bold;
      margin-top: 10px;
      margin-bottom: 8px;
    }
    
    p {
      margin: 8px 0;
    }
    
    ul, ol {
      margin: 10px 0;
      padding-left: 30px;
    }
    
    li {
      margin: 5px 0;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 11pt;
    }
    
    table th,
    table td {
      border: 1px solid #000;
      padding: 8px;
      text-align: left;
    }
    
    table th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
    
    strong, b {
      font-weight: bold;
    }
    
    em, i {
      font-style: italic;
    }
    
    img {
      max-width: 100%;
      height: auto;
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>
    `.trim();

    // Set content
    await page.setContent(htmlTemplate, {
      waitUntil: 'networkidle0',
    });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '2.54cm',
        right: '2.54cm',
        bottom: '2.54cm',
        left: '2.54cm',
      },
    });

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('Error rendering HTML description to PDF with Puppeteer:', error);
    return null; // Fallback to plain text
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

