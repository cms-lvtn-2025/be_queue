import PDFDocument from 'pdfkit';
import { Template1Data } from './document.types';

/**
 * PDF Generator - Tạo PDF từ template data
 */
export class PDFGenerator {
  /**
   * Tạo PDF từ Template 1 data và trả về Buffer
   * @param data - Data cho template 1
   * @returns Promise<Buffer> - PDF buffer
   */
  public async generateTemplate1PDF(data: Template1Data): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: {
            top: 72,
            bottom: 72,
            left: 72,
            right: 72,
          },
        });

        const chunks: Buffer[] = [];

        // Collect PDF chunks
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Generate PDF content
        this.renderTemplate1(doc, data);

        // Finalize PDF
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Render HTML content directly to PDF with support for lists, tables, and other elements
   * Public method để có thể dùng từ nơi khác
   */
  public renderHtmlToPdf(doc: PDFKit.PDFDocument, html: string): void {
    if (!html || typeof html !== 'string') {
      return;
    }

    // Remove style attributes and classes (not needed for PDF)
    let processedHtml = html.replace(/\s*(style|class)="[^"]*"/gi, '');

    // Parse and render HTML elements
    this.parseAndRenderHtml(doc, processedHtml);
  }

  /**
   * Parse HTML and render to PDF - handles lists, tables, and other elements
   */
  private parseAndRenderHtml(doc: PDFKit.PDFDocument, html: string): void {
    // Process tables first - extract and render them
    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    let tableIndex = 0;
    const tables: string[] = [];
    
    let processedHtml = html.replace(tableRegex, (match, tableContent) => {
      tables.push(match);
      return `__TABLE_${tableIndex++}__`;
    });

    // Extract and render tables
    tableIndex = 0;
    const parts = processedHtml.split(/__(TABLE_\d+)__/);
    
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].match(/^TABLE_\d+$/)) {
        // Render table
        const tableHtml = tables[tableIndex++];
        this.renderHtmlTable(doc, tableHtml);
      } else if (parts[i].trim()) {
        // Render regular HTML content
        this.renderHtmlContent(doc, parts[i]);
      }
    }
  }

  /**
   * Extract and render HTML table
   */
  private renderHtmlTable(doc: PDFKit.PDFDocument, tableHtml: string): void {
    const rows: string[][] = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      const rowContent = rowMatch[1];
      const cells: string[] = [];
      const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cellMatch;

      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        const cellContent = cellMatch[1];
        // Strip HTML tags and decode entities
        const plainText = cellContent
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        cells.push(this.decodeHtmlEntities(plainText));
      }

      if (cells.length > 0) {
        rows.push(cells);
      }
    }

    if (rows.length > 0) {
      this.renderTable(doc, rows);
    }
  }

  /**
   * Render HTML content (non-table elements)
   */
  private renderHtmlContent(doc: PDFKit.PDFDocument, html: string): void {
    // Handle lists separately for better formatting
    const listRegex = /<[uo]l[^>]*>([\s\S]*?)<\/[uo]l>/gi;
    let listIndex = 0;
    const lists: string[] = [];

    let processedHtml = html.replace(listRegex, (match, listContent) => {
      lists.push(match);
      return `__LIST_${listIndex++}__`;
    });

    // Process lists and other content
    const parts = processedHtml.split(/__(LIST_\d+)__/);
    
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].match(/^LIST_\d+$/)) {
        // Render list
        const listHtml = lists[parseInt(parts[i].match(/\d+/)![0])];
        this.renderHtmlList(doc, listHtml);
      } else if (parts[i].trim()) {
        // Render other HTML content
        this.renderSimpleHtml(doc, parts[i]);
      }
    }
  }

  /**
   * Render HTML list (ul/ol)
   */
  private renderHtmlList(doc: PDFKit.PDFDocument, listHtml: string): void {
    const isOrdered = listHtml.toLowerCase().startsWith('<ol');
    const itemRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let itemMatch;
    let itemIndex = 1;

    doc.moveDown(0.3);

    while ((itemMatch = itemRegex.exec(listHtml)) !== null) {
      const itemContent = itemMatch[1];
      const plainText = this.stripHtmlTags(itemContent);
      const decodedText = this.decodeHtmlEntities(plainText);

      // Bullet or number
      const prefix = isOrdered ? `${itemIndex}. ` : '• ';
      doc.text(prefix + decodedText, { indent: 20, lineGap: 2 });
      
      if (isOrdered) itemIndex++;
    }

    doc.moveDown(0.5);
  }

  /**
   * Render simple HTML content (paragraphs, headings, etc.)
   */
  private renderSimpleHtml(doc: PDFKit.PDFDocument, html: string): void {
    // Process block elements
    html = html.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (match, content) => {
      const text = this.stripHtmlTags(content);
      return `\n\n__HEADING1__${text}__END__\n\n`;
    });

    html = html.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (match, content) => {
      const text = this.stripHtmlTags(content);
      return `\n\n__HEADING2__${text}__END__\n\n`;
    });

    html = html.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (match, content) => {
      const text = this.stripHtmlTags(content);
      return `\n\n__HEADING3__${text}__END__\n\n`;
    });

    html = html.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (match, content) => {
      const text = this.stripHtmlTags(content);
      return `\n${text}\n`;
    });

    html = html.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, (match, content) => {
      const text = this.stripHtmlTags(content);
      return `\n${text}\n`;
    });

    html = html.replace(/<br\s*\/?>/gi, '\n');
    html = html.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '__BOLD__$1__ENDBOLD__');
    html = html.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '__BOLD__$1__ENDBOLD__');
    html = html.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '__ITALIC__$1__ENDITALIC__');
    html = html.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '__ITALIC__$1__ENDITALIC__');

    // Remove remaining HTML tags
    html = html.replace(/<[^>]+>/g, '');

    // Decode entities
    html = this.decodeHtmlEntities(html);

    // Render processed content
    const parts = html.split(/(__HEADING\d__|__END__|__BOLD__|__ENDBOLD__|__ITALIC__|__ENDITALIC__)/);
    let inBold = false;
    let inItalic = false;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (part === '__HEADING1__') {
        doc.fontSize(18).font('Bold');
      } else if (part === '__HEADING2__') {
        doc.fontSize(16).font('Bold');
      } else if (part === '__HEADING3__') {
        doc.fontSize(14).font('Bold');
      } else if (part === '__END__') {
        doc.fontSize(12).font('Regular');
        doc.moveDown(0.5);
      } else if (part === '__BOLD__') {
        inBold = true;
        doc.font('Bold');
      } else if (part === '__ENDBOLD__') {
        inBold = false;
        doc.font('Regular');
      } else if (part === '__ITALIC__') {
        inItalic = true;
        doc.font('Italic');
      } else if (part === '__ENDITALIC__') {
        inItalic = false;
        doc.font('Regular');
      } else {
        // Regular text content
        const text = part;
        // Split by newlines to handle multiple lines
        const lines = text.split('\n');
        for (let j = 0; j < lines.length; j++) {
          const line = lines[j].trim();
          if (line) {
            doc.text(line, { lineGap: 2 });
          } else if (j < lines.length - 1) {
            // Empty line - add spacing
            doc.moveDown(0.3);
          }
        }
      }
    }

    // Reset font
    doc.fontSize(12).font('Regular');
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtmlTags(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Render a table to PDF
   */
  private renderTable(doc: PDFKit.PDFDocument, rows: string[][]): void {
    if (rows.length === 0) return;

    const pageWidth = doc.page.width;
    const pageMargins = doc.page.margins;
    const availableWidth = pageWidth - pageMargins.left - pageMargins.right;
    const colCount = Math.max(...rows.map(row => row.length));
    
    if (colCount === 0) return;

    const colWidth = availableWidth / colCount;
    const rowHeight = 20;
    const fontSize = 10;

    doc.moveDown(0.5);
    const startY = doc.y;

    rows.forEach((row, rowIndex) => {
      const currentY = startY + (rowIndex * rowHeight);
      let currentX = doc.x;

      // Draw row background and border
      doc.rect(currentX, currentY, availableWidth, rowHeight).stroke();

      // Draw cells
      for (let colIndex = 0; colIndex < colCount; colIndex++) {
        const cellText = row[colIndex] || '';
        
        // Draw cell border
        doc.rect(currentX, currentY, colWidth, rowHeight).stroke();

        // Draw cell text
        if (cellText) {
          doc.fontSize(fontSize)
             .font('Regular')
             .text(cellText, currentX + 5, currentY + 5, {
               width: colWidth - 10,
               height: rowHeight - 10,
               align: 'left',
               ellipsis: true,
             });
        }

        currentX += colWidth;
      }
    });

    // Move cursor after table
    doc.y = startY + (rows.length * rowHeight);
    doc.x = doc.page.margins.left;
  }

  /**
   * Decode HTML entities to text
   */
  private decodeHtmlEntities(html: string): string {
    if (!html || typeof html !== 'string') {
      return '';
    }

    let text = html;

    // Decode numeric HTML entities first
    text = text.replace(/&#(\d+);/g, (match, dec) => {
      return String.fromCharCode(parseInt(dec, 10));
    });
    text = text.replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });

    // Common HTML entities map
    const entities: { [key: string]: string } = {
      '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
      '&#39;': "'", '&apos;': "'",
      // Vietnamese entities (most common)
      '&aacute;': 'á', '&agrave;': 'à', '&ả;': 'ả', '&ã;': 'ã', '&ạ;': 'ạ',
      '&ă;': 'ă', '&ắ;': 'ắ', '&ằ;': 'ằ', '&ẳ;': 'ẳ', '&ẵ;': 'ẵ', '&ặ;': 'ặ',
      '&â;': 'â', '&ấ;': 'ấ', '&ầ;': 'ầ', '&ẩ;': 'ẩ', '&ẫ;': 'ẫ', '&ậ;': 'ậ',
      '&é;': 'é', '&è;': 'è', '&ẻ;': 'ẻ', '&ẽ;': 'ẽ', '&ẹ;': 'ẹ',
      '&ê;': 'ê', '&ế;': 'ế', '&ề;': 'ề', '&ể;': 'ể', '&ễ;': 'ễ', '&ệ;': 'ệ',
      '&í;': 'í', '&ì;': 'ì', '&ỉ;': 'ỉ', '&ĩ;': 'ĩ', '&ị;': 'ị',
      '&ó;': 'ó', '&ò;': 'ò', '&ỏ;': 'ỏ', '&õ;': 'õ', '&ọ;': 'ọ',
      '&ô;': 'ô', '&ố;': 'ố', '&ồ;': 'ồ', '&ổ;': 'ổ', '&ỗ;': 'ỗ', '&ộ;': 'ộ',
      '&ơ;': 'ơ', '&ớ;': 'ớ', '&ờ;': 'ờ', '&ở;': 'ở', '&ỡ;': 'ỡ', '&ợ;': 'ợ',
      '&ú;': 'ú', '&ù;': 'ù', '&ủ;': 'ủ', '&ũ;': 'ũ', '&ụ;': 'ụ',
      '&ư;': 'ư', '&ứ;': 'ứ', '&ừ;': 'ừ', '&ử;': 'ử', '&ữ;': 'ữ', '&ự;': 'ự',
      '&ỳ;': 'ỳ', '&ỷ;': 'ỷ', '&ỹ;': 'ỹ', '&ỵ;': 'ỵ',
      '&yacute;': 'ý', '&Yacute;': 'Ý',
      '&đ;': 'đ', '&Đ;': 'Đ',
    };

    for (const [entity, char] of Object.entries(entities)) {
      text = text.replace(new RegExp(entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), char);
    }

    return text;
  }

  /**
   * Convert HTML content (from TinyMCE) to plain text for PDF rendering (fallback method)
   * - Strips HTML tags
   * - Decodes HTML entities (including numeric entities like &#123; or &#xAB;)
   * - Preserves basic structure (headings, lists)
   */
  private convertHtmlToPlainText(html: string): string {
    if (!html || typeof html !== 'string') {
      return '';
    }

    let text = html;

    // First, decode numeric HTML entities (&#123; or &#xAB;)
    // Handle decimal entities (&#123;)
    text = text.replace(/&#(\d+);/g, (match, dec) => {
      return String.fromCharCode(parseInt(dec, 10));
    });
    // Handle hexadecimal entities (&#xAB; or &#XAB;)
    text = text.replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });

    // Common HTML entities map
    const entities: { [key: string]: string } = {
      '&nbsp;': ' ',
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
      // Vietnamese lowercase entities
      '&aacute;': 'á', '&agrave;': 'à', '&ả;': 'ả', '&ã;': 'ã', '&ạ;': 'ạ',
      '&ă;': 'ă', '&ắ;': 'ắ', '&ằ;': 'ằ', '&ẳ;': 'ẳ', '&ẵ;': 'ẵ', '&ặ;': 'ặ',
      '&â;': 'â', '&ấ;': 'ấ', '&ầ;': 'ầ', '&ẩ;': 'ẩ', '&ẫ;': 'ẫ', '&ậ;': 'ậ',
      '&é;': 'é', '&è;': 'è', '&ẻ;': 'ẻ', '&ẽ;': 'ẽ', '&ẹ;': 'ẹ',
      '&ê;': 'ê', '&ế;': 'ế', '&ề;': 'ề', '&ể;': 'ể', '&ễ;': 'ễ', '&ệ;': 'ệ',
      '&í;': 'í', '&ì;': 'ì', '&ỉ;': 'ỉ', '&ĩ;': 'ĩ', '&ị;': 'ị',
      '&ó;': 'ó', '&ò;': 'ò', '&ỏ;': 'ỏ', '&õ;': 'õ', '&ọ;': 'ọ',
      '&ô;': 'ô', '&ố;': 'ố', '&ồ;': 'ồ', '&ổ;': 'ổ', '&ỗ;': 'ỗ', '&ộ;': 'ộ',
      '&ơ;': 'ơ', '&ớ;': 'ớ', '&ờ;': 'ờ', '&ở;': 'ở', '&ỡ;': 'ỡ', '&ợ;': 'ợ',
      '&ú;': 'ú', '&ù;': 'ù', '&ủ;': 'ủ', '&ũ;': 'ũ', '&ụ;': 'ụ',
      '&ư;': 'ư', '&ứ;': 'ứ', '&ừ;': 'ừ', '&ử;': 'ử', '&ữ;': 'ữ', '&ự;': 'ự',
      '&ỳ;': 'ỳ', '&ỷ;': 'ỷ', '&ỹ;': 'ỹ', '&ỵ;': 'ỵ',
      '&đ;': 'đ',
      // Vietnamese uppercase entities
      '&Aacute;': 'Á', '&Agrave;': 'À', '&Acirc;': 'Â', '&Atilde;': 'Ã',
      '&Eacute;': 'É', '&Egrave;': 'È', '&Ecirc;': 'Ê',
      '&Iacute;': 'Í', '&Igrave;': 'Ì',
      '&Oacute;': 'Ó', '&Ograve;': 'Ò', '&Ocirc;': 'Ô', '&Otilde;': 'Õ',
      '&Uacute;': 'Ú', '&Ugrave;': 'Ù',
      '&Yacute;': 'Ý', '&yacute;': 'ý',
      '&Đ;': 'Đ',
    };

    // Decode named HTML entities
    for (const [entity, char] of Object.entries(entities)) {
      text = text.replace(new RegExp(entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), char);
    }

    // Convert headings to plain text with spacing
    text = text.replace(/<h[1-6][^>]*>/gi, '\n\n').replace(/<\/h[1-6]>/gi, '\n');
    
    // Convert list items to plain text with bullets
    text = text.replace(/<li[^>]*>/gi, '\n• ').replace(/<\/li>/gi, '');
    
    // Convert unordered/ordered lists to line breaks
    text = text.replace(/<\/?[uo]l[^>]*>/gi, '\n');
    
    // Convert paragraphs to line breaks
    text = text.replace(/<p[^>]*>/gi, '\n').replace(/<\/p>/gi, '\n');
    
    // Convert divs to line breaks (but keep content)
    text = text.replace(/<div[^>]*>/gi, '\n').replace(/<\/div>/gi, '\n');
    
    // Convert line breaks
    text = text.replace(/<br\s*\/?>/gi, '\n');
    
    // Convert strong/bold tags (will be rendered as regular text)
    text = text.replace(/<\/?strong[^>]*>/gi, '');
    text = text.replace(/<\/?b[^>]*>/gi, '');
    
    // Convert emphasis/italic tags
    text = text.replace(/<\/?em[^>]*>/gi, '');
    text = text.replace(/<\/?i[^>]*>/gi, '');
    
    // Remove all remaining HTML tags
    text = text.replace(/<[^>]+>/g, '');
    
    // Decode any remaining entities (in case we missed some)
    // This catches any remaining &...; patterns that might be entities
    text = text.replace(/&([a-z]+);/gi, (match, entity) => {
      const lowerEntity = '&' + entity.toLowerCase() + ';';
      return entities[lowerEntity] || match;
    });
    
    // Clean up multiple whitespaces and line breaks
    text = text
      .replace(/\n\s*\n\s*\n+/g, '\n\n') // Max 2 consecutive newlines
      .replace(/[ \t]+/g, ' ') // Multiple spaces to single space
      .trim();

    return text;
  }

  /**
   * Render nội dung Template 1
   */
  private renderTemplate1(doc: PDFKit.PDFDocument, data: Template1Data): void {
    // Register Liberation Serif fonts - Times New Roman style (hỗ trợ tiếng Việt)
    const fontPath = '/usr/share/fonts/truetype/liberation';
    doc.registerFont('Regular', `${fontPath}/LiberationSerif-Regular.ttf`);
    doc.registerFont('Bold', `${fontPath}/LiberationSerif-Bold.ttf`);
    doc.registerFont('Italic', `${fontPath}/LiberationSerif-Italic.ttf`);
    doc.registerFont('BoldItalic', `${fontPath}/LiberationSerif-BoldItalic.ttf`);

    // Header - gốc trái, IN ĐẬM, cỡ 12
    doc.moveDown(1);
    doc
      .fontSize(12)
      .font('Bold')
      .text('TRƯỜNG ĐẠI HỌC BÁCH KHOA – ĐHQG TPHCM', { align: 'left' })
      .text('KHOA KHOA HỌC VÀ KỸ THUẬT MÁY TÍNH', { align: 'left' })
      .moveDown(1);

    // Title - căn giữa, IN ĐẬM, cỡ 12
    doc
      .fontSize(12)
      .font('Bold')
      .text('THÔNG TIN ĐỀ TÀI', { align: 'center' })
      .text('GIAI ĐOẠN 1 (GĐ1): ĐỀ CƯƠNG LUẬN VĂN/ ĐỒ ÁN CHUYÊN NGÀNH/', { align: 'center' })
      .text('ĐỒ ÁN MÔN HỌC KỸ THUẬT MÁY TÍNH', { align: 'center' })
      .text(`HỌC KỲ ${data.semester} NĂM HỌC ${data.academicYear}`, { align: 'center' })
      .moveDown(1);

    // Tên đề tài - gốc trái, IN ĐẬM, cỡ 12
    doc
      .fontSize(12)
      .font('Bold')
      .text('Tên đề tài:', { continued: false })
      .moveDown(0.3)
      .text(`- Tiếng Việt: ${data.thesisTitle.vietnamese}`)
      .text(`- Tiếng Anh: ${data.thesisTitle.english}`)
      .moveDown(1);

    // Thông tin công ty - IN ĐẬM, cỡ 12
    doc
      .fontSize(12)
      .font('Bold')
      .text(`Công ty/ Doanh nghiệp hợp tác: ${data.company?.name || 'None'}`)
      .text(`Địa chỉ: ${data.company?.address || '……………………………'}`)
      .text(`Website link: ${data.company?.websiteLink || '……………………'}`)
      .text(`Người đại diện giao tiếp với Khoa: ${data.company?.representativeName || '……………………'}`)
      .font('Italic')
      .text('(tối thiểu phải có thông tin họ tên, email công vụ/ cá nhân).')
      .moveDown(1);

    // Thông tin CBHD - cỡ 12
    data.teachers.forEach((teacher, index) => {
      const teacherNum = index + 1;
      doc
        .fontSize(12)
        .font('Regular')
        .text(`CBHD${teacherNum}: ${teacher.name}`, { continued: false })
        .text(`Email${teacherNum}: `, { continued: true, underline: false })
        .fillColor('blue')
        .text(teacher.email, { link: `mailto:${teacher.email}`, underline: true })
        .fillColor('black');

      if (index === 0) {
        doc
          .fontSize(12)
          .font('BoldItalic')
          .text('(Chuẩn CBHD1/ chính: ngạch giảng viên, đạt chuẩn giảng dạy lý thuyết.)');
      }
    });
    doc.moveDown(0.5);

    // Ngành - cỡ 12
    doc.fontSize(12).font('Regular').text('Ngành:');

    const majorsList = [
      { label: 'Khoa học máy tính', value: 'Khoa học máy tính' },
      { label: 'Kỹ thuật máy tính', value: 'Kỹ thuật máy tính' },
      { label: 'Liên ngành CS-CE', value: 'Liên ngành CS-CE' }
    ];

    const currentY1 = doc.y;
    const startX = doc.x;
    let currentX = startX;

    majorsList.forEach((m, idx) => {
      const isChecked = m.value === data.major;

      // Draw checkbox
      doc.rect(currentX, currentY1, 10, 10).stroke();
      if (isChecked) {
        // Draw X for checked
        doc.moveTo(currentX + 2, currentY1 + 2)
           .lineTo(currentX + 8, currentY1 + 8)
           .moveTo(currentX + 8, currentY1 + 2)
           .lineTo(currentX + 2, currentY1 + 8)
           .stroke();
      }

      // Draw label
      doc.fontSize(12).font('Regular');
      doc.text(m.label, currentX + 15, currentY1, { continued: false, lineBreak: false });
      currentX += doc.widthOfString(m.label) + 60; // Move to next checkbox position
    });

    // Move cursor down after checkboxes
    doc.y = currentY1 + 15;
    doc.x = startX;

    // Chương trình đào tạo - cỡ 12 (xuống dòng)
    doc.fontSize(12).font('Regular').text('Chương trình đào tạo:');

    const programsList = [
      { label: 'Tiếng Việt (CQ/CN/B2/SN/VLVH/TX)', value: 'Tiếng Việt' },
      { label: 'Tiếng Anh (CC/CT/QT)', value: 'Tiếng Anh' }
    ];

    const currentY2 = doc.y;
    let currentX2 = startX;

    programsList.forEach((p, idx) => {
      const isChecked = p.value === data.programLanguage;

      // Draw checkbox
      doc.rect(currentX2, currentY2, 10, 10).stroke();
      if (isChecked) {
        // Draw X for checked
        doc.moveTo(currentX2 + 2, currentY2 + 2)
           .lineTo(currentX2 + 8, currentY2 + 8)
           .moveTo(currentX2 + 8, currentY2 + 2)
           .lineTo(currentX2 + 2, currentY2 + 8)
           .stroke();
      }

      // Draw label
      doc.fontSize(12).font('Regular');
      doc.text(p.label, currentX2 + 15, currentY2, { continued: false, lineBreak: false });
      currentX2 += doc.widthOfString(p.label) + 60; // Move to next checkbox position
    });

    // Move cursor down after checkboxes
    doc.y = currentY2 + 15;
    doc.x = startX;
    doc.moveDown(0.5);

    // Số lượng sinh viên - cỡ 12
    doc
      .fontSize(12)
      .font('Regular')
      .text(`Số lượng sinh viên thực hiện: ${data.students.length}.`);

    // Danh sách sinh viên - cỡ 12, với major từ data
    data.students.forEach((student) => {
      doc
        .fontSize(12)
        .font('Regular')
        .text(`${student.name} - ${student.studentId} - ${student.program}`);
    });
    doc.moveDown(1);

    // Mô tả - người dùng nhập gì thì hiển thị y vậy
    // description is tiny mce html content - render HTML trực tiếp vào PDF
    if (data.description) {
      doc.fontSize(12).font('Regular');
      this.renderHtmlToPdf(doc, data.description);
    }
  }
}

export default new PDFGenerator();
