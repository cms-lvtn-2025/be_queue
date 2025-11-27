/**
 * Test PDF Generation
 *
 * Chạy: npx ts-node src/queue/minio/test-pdf-gen.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import pdfGenerator from './pdf-generator';
import { Template1Data, Major, ProgramLanguage } from './document.types';

async function testPDFGeneration() {
  try {
    console.log('🔄 Starting PDF generation test...\n');

    // Sample data
    const data: Template1Data = {
      semester: '1',
      academicYear: '2024-2025',

      thesisTitle: {
        vietnamese: 'Hệ thống kiểm tra đạo văn tự động cho luận văn tốt nghiệp',
        english: 'Automatic Plagiarism Detection System for Graduation Thesis',
      },

      company: {
        name: 'Công ty TNHH Công nghệ ABC',
        address: '123 Lý Thường Kiệt, Quận 10, TP.HCM',
        websiteLink: 'https://abc-tech.com',
        representativeName: 'Nguyễn Văn A - nguyenvana@abc-tech.com',
      },

      teachers: [
        {
          name: 'TS. Trần Minh Quang',
          email: 'tmquang@hcmut.edu.vn',
        },
        {
          name: 'ThS. Lê Thị Hương',
          email: 'lthuong@hcmut.edu.vn',
        },
      ],

      students: [
        {
          name: 'Nguyễn Thái Lý',
          studentId: '2011001',
          program: 'CQ',
        },
        {
          name: 'Trần Văn B',
          studentId: '2011002',
          program: 'CQ',
        },
        {
          name: 'Lê Thị C',
          studentId: '2011003',
          program: 'CQ',
        },
      ],

      major: Major.CS,
      programLanguage: ProgramLanguage.VIETNAMESE,
      programType: 'CQ',

      description: `
Đề tài nghiên cứu và phát triển hệ thống kiểm tra đạo văn tự động cho luận văn tốt nghiệp.

Mục tiêu:
- Xây dựng hệ thống có khả năng phát hiện đạo văn chính xác cao
- Tích hợp với các công cụ kiểm tra đạo văn hiện có
- Cung cấp báo cáo chi tiết về tỷ lệ và nguồn trùng lặp
- Hỗ trợ nhiều định dạng file (PDF, DOCX, TXT)

Công nghệ sử dụng:
- Backend: Node.js, TypeScript, GraphQL
- Frontend: React, TypeScript, TailwindCSS
- Database: PostgreSQL, MongoDB
- Storage: MinIO
- Queue: BullMQ, Redis

Kết quả dự kiến:
- Hệ thống web hoàn chỉnh với giao diện thân thiện
- API mở cho việc tích hợp
- Tài liệu hướng dẫn sử dụng chi tiết
- Báo cáo nghiên cứu về các thuật toán kiểm tra đạo văn
      `.trim(),
    };

    console.log('📝 Generating PDF from template data...');
    const pdfBuffer = await pdfGenerator.generateTemplate1PDF(data);
    console.log(`✅ PDF generated successfully! Size: ${pdfBuffer.length} bytes\n`);

    // Save PDF to file
    const outputDir = path.join(__dirname, 'test-output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, `test-thesis-report-${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, pdfBuffer);

    console.log(`💾 PDF saved to: ${outputPath}`);
    console.log(`📄 File size: ${(pdfBuffer.length / 1024).toFixed(2)} KB\n`);

    console.log('✨ Test completed successfully!');
    console.log(`\n👉 Open the PDF file to verify: ${outputPath}`);

  } catch (error) {
    console.error('❌ Error during PDF generation test:', error);
    process.exit(1);
  }
}

// Run test
testPDFGeneration();
