/**
 * EXAMPLE: Cách sử dụng MinIO Service
 *
 * Flow hoàn chỉnh:
 * 1. Load MinIO config từ database
 * 2. Tạo MinIO service instance
 * 3. Lấy data từ database
 * 4. Tạo PDF từ template với data
 * 5. Upload PDF buffer lên MinIO
 * 6. Lấy URL để download
 */

import { MinioService, Template1Data, Major, ProgramLanguage } from './index';
import { MinioConfigModel } from '../../database/models';

/**
 * Example: Generate PDF và upload lên MinIO
 */
async function generateAndUploadThesisReport() {
  try {
    // STEP 0: Load MinIO config từ MongoDB
    const minioConfig = await MinioConfigModel.getActiveConfig();
    if (!minioConfig) {
      throw new Error('No active MinIO configuration found');
    }

    // Create MinIO service instance
    const minioService = new MinioService(minioConfig);

    // STEP 1: Chuẩn bị data (bạn lấy từ database)
    const data: Template1Data = {
      semester: '1',
      academicYear: '2024-2025',

      thesisTitle: {
        vietnamese: 'Hệ thống quản lý đề tài tốt nghiệp',
        english: 'Thesis Management System',
      },

      company: {
        name: 'Công ty TNHH ABC',
        address: '123 Đường XYZ, Quận 1, TP.HCM',
        websiteLink: 'https://abc.com',
        representativeName: 'Nguyễn Văn A - email@abc.com',
      },

      teachers: [
        {
          name: 'TS. Nguyễn Văn B',
          email: 'nvb@hcmut.edu.vn',
        },
        {
          name: 'ThS. Trần Thị C',
          email: 'ttc@hcmut.edu.vn',
        },
      ],

      students: [
        {
          name: 'Lê Văn D',
          studentId: '2011001',
          program: 'CQ',
        },
        {
          name: 'Phạm Thị E',
          studentId: '2011002',
          program: 'CQ',
        },
        {
          name: 'Hoàng Văn F',
          studentId: '2011003',
          program: 'CQ',
        },
      ],

      major: Major.CS,
      programLanguage: ProgramLanguage.VIETNAMESE,
      programType: 'CQ',

      description: `
Đề tài này nghiên cứu và xây dựng hệ thống quản lý đề tài tốt nghiệp cho Khoa KHMT.

Hệ thống bao gồm các chức năng chính:
- Quản lý đề tài và sinh viên
- Phân công giảng viên hướng dẫn
- Theo dõi tiến độ thực hiện
- Kiểm tra đạo văn tự động
- Tạo báo cáo và thống kê

Công nghệ sử dụng: Node.js, React, PostgreSQL, MinIO.
      `.trim(),
    };

    // STEP 2: Generate PDF từ template
    console.log('Generating PDF...');
    const pdfBuffer = await minioService.generateTemplate1PDF(data);
    console.log(`PDF generated: ${pdfBuffer.length} bytes`);

    // STEP 3: Upload PDF lên MinIO
    console.log('Uploading to MinIO...');
    const objectName = await minioService.uploadBuffer(
      pdfBuffer,
      `thesis-report-${data.students[0].studentId}.pdf`,
      'application/pdf'
    );
    console.log(`Uploaded to MinIO: ${objectName}`);

    // STEP 4: Lấy presigned URL để download (URL có thời hạn 7 ngày)
    const downloadUrl = await minioService.getPresignedUrl(objectName);
    console.log(`Download URL: ${downloadUrl}`);

    return {
      objectName,
      downloadUrl,
      pdfSize: pdfBuffer.length,
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

/**
 * Example: Lấy file từ MinIO
 */
async function downloadFileFromMinio(objectName: string) {
  try {
    // Load config and create service
    const minioConfig = await MinioConfigModel.getActiveConfig();
    if (!minioConfig) throw new Error('No active MinIO config');
    const minioService = new MinioService(minioConfig);

    // Cách 1: Lấy về dạng Buffer
    const buffer = await minioService.getFile(objectName);
    console.log(`Downloaded file: ${buffer.length} bytes`);

    // Làm gì đó với buffer (ví dụ: gửi qua response, lưu vào disk, etc.)
    return buffer;

    // Cách 2: Lấy về dạng Stream (tốt cho file lớn)
    // const stream = await minioService.getFileStream(objectName);
    // stream.pipe(response); // Pipe vào HTTP response
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
}

/**
 * Example: Xóa file từ MinIO
 */
async function deleteFileFromMinio(objectName: string) {
  try {
    const minioConfig = await MinioConfigModel.getActiveConfig();
    if (!minioConfig) throw new Error('No active MinIO config');
    const minioService = new MinioService(minioConfig);

    await minioService.deleteFile(objectName);
    console.log('File deleted successfully');
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
}

/**
 * Example: List tất cả files
 */
async function listAllFiles() {
  try {
    const minioConfig = await MinioConfigModel.getActiveConfig();
    if (!minioConfig) throw new Error('No active MinIO config');
    const minioService = new MinioService(minioConfig);

    const files = await minioService.listFiles();
    console.log(`Found ${files.length} files:`);
    files.forEach((file) => {
      console.log(`- ${file.name} (${file.size} bytes)`);
    });
    return files;
  } catch (error) {
    console.error('Error listing files:', error);
    throw error;
  }
}

/**
 * Example: Check file có tồn tại không
 */
async function checkFileExists(objectName: string) {
  try {
    const minioConfig = await MinioConfigModel.getActiveConfig();
    if (!minioConfig) throw new Error('No active MinIO config');
    const minioService = new MinioService(minioConfig);

    const exists = await minioService.fileExists(objectName);
    console.log(`File ${objectName} exists: ${exists}`);
    return exists;
  } catch (error) {
    console.error('Error checking file:', error);
    throw error;
  }
}

/**
 * COMPLETE FLOW: Từ database → Generate PDF → Upload → Get URL
 */
async function completeFlow() {
  try {
    // 0. Load MinIO config
    const minioConfig = await MinioConfigModel.getActiveConfig();
    if (!minioConfig) throw new Error('No active MinIO config');
    const minioService = new MinioService(minioConfig);

    // 1. Lấy data từ database (giả sử bạn có function này)
    // const dbData = await getThesisDataFromDatabase(thesisId);

    // 2. Map database data sang Template1Data format
    const templateData: Template1Data = {
      // Map your database data here
      semester: '1',
      academicYear: '2024-2025',
      // ... rest of the data
    } as Template1Data;

    // 3. Generate PDF
    const pdfBuffer = await minioService.generateTemplate1PDF(templateData);

    // 4. Upload to MinIO
    const objectName = await minioService.uploadBuffer(
      pdfBuffer,
      'thesis-report.pdf',
      'application/pdf'
    );

    // 5. Get download URL
    const downloadUrl = await minioService.getPresignedUrl(objectName);

    // 6. Save objectName vào database để tracking
    // await saveToDatabase({ thesisId, minioObjectName: objectName });

    return { objectName, downloadUrl };
  } catch (error) {
    console.error('Complete flow error:', error);
    throw error;
  }
}

// Export examples
export {
  generateAndUploadThesisReport,
  downloadFileFromMinio,
  deleteFileFromMinio,
  listAllFiles,
  checkFileExists,
  completeFlow,
};
