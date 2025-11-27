# MinIO Service & PDF Generator

Hệ thống quản lý MinIO và tạo PDF cho plagiarism checker service.

## 📁 File Structure

```
minio/
├── document.types.ts          # TypeScript interfaces cho templates
├── minio.service.ts           # MinIO service class
├── pdf-generator.ts           # PDF generation logic
├── test-pdf-gen.ts           # Test PDF generation (có company)
├── test-pdf-no-company.ts    # Test PDF generation (không có company)
├── example.usage.ts          # Ví dụ sử dụng đầy đủ
├── index.ts                  # Export module
└── test-output/              # Thư mục chứa PDF test
```

## 🚀 Setup

### 1. Import MinIO Config vào MongoDB

```bash
# Sử dụng mongoimport
mongoimport --uri="mongodb://localhost:27017/plagiarism-checker" \
  --collection=minio_configs \
  --file=src/database/seeds/minio-config.json \
  --jsonArray

# Hoặc sử dụng mongosh
mongosh
use plagiarism-checker
db.minio_configs.insertOne({
  name: "MINIO",
  endPoint: "127.0.0.1",
  port: 10005,
  useSSL: false,
  accessKey: "thaily",
  secretKey: "Th@i2004",
  bucketName: "lvtn",
  enabled: true,
  region: "us-east-1",
  createdAt: new Date(),
  updatedAt: new Date()
})
```

### 2. Test PDF Generation

```bash
# Test với company info
npx ts-node src/queue/minio/test-pdf-gen.ts

# Test không có company info
npx ts-node src/queue/minio/test-pdf-no-company.ts
```

PDF sẽ được tạo trong `src/queue/minio/test-output/`

## 💻 Sử dụng

### 1. Tạo MinIO Service Instance

```typescript
import { MinioService } from './queue/minio';
import { MinioConfigModel } from './database/models';

// Load config từ MongoDB
const minioConfig = await MinioConfigModel.getActiveConfig();
if (!minioConfig) {
  throw new Error('No active MinIO configuration found');
}

// Tạo MinIO service instance
const minioService = new MinioService(minioConfig);
```

### 2. Generate PDF

```typescript
import { pdfGenerator, Template1Data, Major, ProgramLanguage } from './queue/minio';

const data: Template1Data = {
  semester: '1',
  academicYear: '2024-2025',
  thesisTitle: {
    vietnamese: 'Tên đề tài tiếng Việt',
    english: 'English Thesis Title',
  },
  teachers: [
    {
      name: 'TS. Nguyễn Văn A',
      email: 'nva@hcmut.edu.vn',
    },
  ],
  students: [
    {
      name: 'Sinh viên 1',
      studentId: '2011001',
      program: 'CQ',
    },
  ],
  major: Major.CS,
  programLanguage: ProgramLanguage.VIETNAMESE,
  programType: 'CQ',
  description: 'Mô tả đề tài...',
};

// Generate PDF
const pdfBuffer = await pdfGenerator.generateTemplate1PDF(data);
```

### 3. Upload lên MinIO

```typescript
const objectName = await minioService.uploadBuffer(
  pdfBuffer,
  'thesis-report.pdf',
  'application/pdf'
);

console.log(`Uploaded: ${objectName}`);
```

### 4. Lấy Download URL

```typescript
// Get presigned URL (valid for 7 days by default)
const downloadUrl = await minioService.getPresignedUrl(objectName);
console.log(`Download URL: ${downloadUrl}`);
```

### 5. Complete Flow

```typescript
import { MinioService, pdfGenerator, Template1Data } from './queue/minio';
import { MinioConfigModel } from './database/models';

async function generateAndUploadReport(data: Template1Data) {
  // 1. Load MinIO config
  const config = await MinioConfigModel.getActiveConfig();
  const minioService = new MinioService(config);

  // 2. Generate PDF
  const pdfBuffer = await pdfGenerator.generateTemplate1PDF(data);

  // 3. Upload to MinIO
  const objectName = await minioService.uploadBuffer(
    pdfBuffer,
    `report-${Date.now()}.pdf`,
    'application/pdf'
  );

  // 4. Get download URL
  const url = await minioService.getPresignedUrl(objectName);

  return { objectName, url, size: pdfBuffer.length };
}
```

## 📝 Template1Data Interface

```typescript
interface Template1Data {
  semester: string;              // Học kỳ: "1", "2", "Hè"
  academicYear: string;          // Năm học: "2024-2025"

  thesisTitle: {
    vietnamese: string;
    english: string;
  };

  company?: {                    // Optional
    name: string;
    address: string;
    websiteLink: string;
    representativeName: string;
  };

  teachers: Array<{
    name: string;
    email: string;
  }>;

  students: Array<{
    name: string;
    studentId: string;
    program: string;             // CQ, CN, CC, CT, ...
  }>;

  major: Major;                  // CS | CE | CS_CE
  programLanguage: ProgramLanguage; // VIETNAMESE | ENGLISH
  programType?: string;          // CQ, CN, CC, CT, ...
  description: string;
}
```

## 🔧 MinIO Service Methods

### Upload Operations
- `uploadBuffer(buffer, filename, contentType)` - Upload file từ Buffer
- `getFile(objectName)` - Download file về Buffer
- `getFileStream(objectName)` - Download file về Stream
- `deleteFile(objectName)` - Xóa 1 file
- `deleteFiles(objectNames[])` - Xóa nhiều files

### File Operations
- `getPresignedUrl(objectName, expiry)` - Lấy URL download có thời hạn
- `listFiles(prefix?)` - List files trong bucket
- `getFileInfo(objectName)` - Lấy thông tin file
- `fileExists(objectName)` - Check file có tồn tại

### PDF Generation
- `generateTemplate1PDF(data)` - Tạo PDF từ Template 1

## 🎨 PDF Template Features

Template 1 bao gồm:
- Header: Thông tin trường/khoa
- Thông tin đề tài (Tiếng Việt + English)
- Thông tin công ty (optional, hiển thị "......" nếu không có)
- Danh sách CBHD (có thể nhiều người)
- Ngành học với checkbox
- Chương trình đào tạo với checkbox
- Danh sách sinh viên
- Mô tả chi tiết
- Footer với timestamp

## 📚 Examples

Xem thêm trong file:
- [example.usage.ts](./example.usage.ts) - Các ví dụ sử dụng đầy đủ
- [test-pdf-gen.ts](./test-pdf-gen.ts) - Test với company
- [test-pdf-no-company.ts](./test-pdf-no-company.ts) - Test không có company

## 🐛 Troubleshooting

### MinIO connection error
- Check MinIO server đang chạy: `http://127.0.0.1:10005`
- Verify credentials trong MongoDB config
- Check network/firewall settings

### PDF generation error
- Xem log chi tiết trong console
- Check data format theo Template1Data interface
- Test với file test-pdf-gen.ts

### MongoDB connection error
- Verify MongoDB đang chạy
- Check connection string
- Verify database name: `plagiarism-checker`
- Check collection: `minio_configs`
