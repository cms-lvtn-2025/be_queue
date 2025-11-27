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
    if (data.description) {
      doc
        .fontSize(12)
        .font('Regular')
        .text(data.description, {
          align: 'left',
          lineGap: 2,
        });
    }
  }
}

export default new PDFGenerator();
