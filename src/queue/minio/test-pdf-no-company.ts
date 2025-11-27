/**
 * Test PDF Generation - Không có thông tin công ty
 *
 * Chạy: npx ts-node src/queue/minio/test-pdf-no-company.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import pdfGenerator from './pdf-generator';
import { Template1Data, Major, ProgramLanguage } from './document.types';

async function testPDFGenerationNoCompany() {
  try {
    console.log('🔄 Starting PDF generation test (No Company)...\n');

    // Sample data WITHOUT company
    const data: Template1Data = {
      semester: 'Hè',
      academicYear: '2023-2024',

      thesisTitle: {
        vietnamese: 'Ứng dụng Machine Learning trong phân tích dữ liệu lớn',
        english: 'Machine Learning Application in Big Data Analysis',
      },

      // NO company field - should show ......

      teachers: [
        {
          name: 'PGS.TS. Phạm Văn D',
          email: 'pvd@hcmut.edu.vn',
        },
      ],

      students: [
        {
          name: 'Hoàng Văn E',
          studentId: '2012001',
          program: 'CC',
        },
      ],

      major: Major.CE,
      programLanguage: ProgramLanguage.ENGLISH,
      programType: 'CC',

      description: `
This thesis focuses on applying machine learning algorithms for big data analysis.

Objectives:
- Study various ML algorithms suitable for big data
- Implement distributed computing framework
- Optimize performance for large-scale datasets
- Develop visualization tools for analysis results

Technologies:
- Python, TensorFlow, Apache Spark
- Hadoop, HDFS
- Docker, Kubernetes

Expected outcomes:
- Scalable ML framework
- Performance benchmarks
- Research paper publication
      `.trim(),
    };

    console.log('📝 Generating PDF from template data (without company info)...');
    const pdfBuffer = await pdfGenerator.generateTemplate1PDF(data);
    console.log(`✅ PDF generated successfully! Size: ${pdfBuffer.length} bytes\n`);

    // Save PDF to file
    const outputDir = path.join(__dirname, 'test-output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, `test-no-company-${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, pdfBuffer);

    console.log(`💾 PDF saved to: ${outputPath}`);
    console.log(`📄 File size: ${(pdfBuffer.length / 1024).toFixed(2)} KB\n`);

    console.log('✨ Test completed successfully!');
    console.log(`\n👉 Open the PDF file to verify company fields show "......" : ${outputPath}`);

  } catch (error) {
    console.error('❌ Error during PDF generation test:', error);
    process.exit(1);
  }
}

// Run test
testPDFGenerationNoCompany();
