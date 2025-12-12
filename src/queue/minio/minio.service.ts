import * as Minio from 'minio';
import { Readable } from 'stream';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import { Template1Data } from './document.types';
import { IMinioConfig, MinioConfigModel } from '../../database/models';
import { renderHtmlDescriptionToPdf } from './html-to-pdf-helper';

export class MinioService {
  private client: Minio.Client;
  private bucketName: string;
  private config: IMinioConfig;

  /**
   * Constructor - Tạo MinIO service với config
   * @param config - MinIO configuration từ MongoDB
   */
  constructor(config: IMinioConfig) {
    if (!config.enabled) {
      throw new Error('MinIO configuration is disabled');
    }

    this.config = config;

    // Initialize MinIO client
    this.client = new Minio.Client({
      endPoint: config.endPoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    });

    this.bucketName = config.bucketName;

    console.log(`MinIO initialized: ${config.endPoint}:${config.port}`);

    // Ensure bucket exists and update connection status
    this.ensureBucket()
      .then(async () => {
        // Update connection status to MongoDB
        await this.updateConnectionStatus(true);
      })
      .catch(async (err) => {
        console.error('Error ensuring bucket exists:', err);
        // Update connection status to MongoDB
        await this.updateConnectionStatus(false, err.message);
      });
  }

  private async ensureBucket(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucketName);
      if (!exists) {
        const region = this.config?.region || 'us-east-1';
        await this.client.makeBucket(this.bucketName, region);
        console.log(`Bucket ${this.bucketName} created successfully`);
      }
    } catch (error) {
      console.error('Error ensuring bucket exists:', error);
      throw error;
    }
  }

  /**
   * Update connection status trong MongoDB
   */
  private async updateConnectionStatus(connected: boolean, error?: string): Promise<void> {
    try {
      await MinioConfigModel.findByIdAndUpdate(this.config._id, {
        connectionStatus: {
          connected,
          lastCheck: new Date(),
          error: error || undefined,
        },
      });
      console.log(`MinIO connection status updated: ${connected ? 'Connected' : 'Disconnected'}`);
    } catch (err) {
      console.error('Error updating MinIO connection status:', err);
    }
  }

  /**
   * Upload file từ Buffer vào MinIO
   * @param params - { buffer: Buffer, filename: string, folder?: string, contentType?: string }
   * @returns Object name (path) trong MinIO
   */
  public async uploadBuffer(
    params: {
      buffer: Buffer | any;
      filename: string;
      folder?: {
        afterSemester?: string;
        semester?: string;
        beforeSemester?: string;
      };
      contentType?: string;
    }
  ): Promise<string> {
    try {
      let { buffer, filename, folder, contentType = 'application/octet-stream' } = params;

      if (!(buffer instanceof Buffer)) {
        buffer = Buffer.from(buffer);
      }

      // Build object name with optional folder prefix
      let objectName: string;
      if (folder) {
        // Normalize folder path (remove leading/trailing slashes)
        const normalizedFolder = [
          folder.beforeSemester,
          folder.semester,
          folder.afterSemester
        ]
          .filter(part => part && part.trim() !== '')
          .map(part => part!.replace(/^\/+|\/+$/g, '')) // Remove leading/trailing slashes
          .join('/');
        objectName = `${normalizedFolder}/${Date.now()}-${filename}`;
      } else {
        objectName = `${Date.now()}-${filename}`;
      }

      console.log(`📤 Uploading to MinIO: ${objectName}`);
      const stream = Readable.from(buffer);

      const metaData = {
        'Content-Type': contentType,
      };

      await this.client.putObject(
        this.bucketName,
        objectName,
        stream,
        buffer.length,
        metaData
      );

      console.log(`File uploaded successfully: ${objectName}`);
      return objectName;
    } catch (error) {
      console.error('Error uploading buffer:', error);
      throw error;
    }
  }

  /**
   * Lấy file từ MinIO dưới dạng Buffer
   * @param objectName - Tên object trong MinIO
   * @returns Buffer của file
   */
  public async getFile(params: { objectName: string }): Promise<Buffer> {
    try {
      const dataStream = await this.client.getObject(this.bucketName, params.objectName);
      const chunks: Buffer[] = [];

      return new Promise((resolve, reject) => {
        dataStream.on('data', (chunk) => chunks.push(chunk));
        dataStream.on('end', () => resolve(Buffer.concat(chunks)));
        dataStream.on('error', reject);
      });
    } catch (error) {
      console.error('Error getting file:', error);
      throw error;
    }
  }

  /**
   * Lấy stream của file từ MinIO (tốt cho file lớn)
   * @param objectName - Tên object trong MinIO
   * @returns Readable stream
   */
  public async getFileStream(objectName: string): Promise<Readable> {
    try {
      return await this.client.getObject(this.bucketName, objectName);
    } catch (error) {
      console.error('Error getting file stream:', error);
      throw error;
    }
  }

  /**
   * Xóa file từ MinIO
   * @param objectName - Tên object cần xóa
   */
  public async deleteFile(params: { objectName: string }): Promise<void> {
    try {
      await this.client.removeObject(this.bucketName, params.objectName);
      console.log(`File deleted successfully: ${params.objectName}`);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Xóa nhiều files cùng lúc
   * @param objectNames - Mảng tên objects cần xóa
   */
  public async deleteFiles(objectNames: string[]): Promise<void> {
    try {
      await this.client.removeObjects(this.bucketName, objectNames);
      console.log(`Files deleted successfully: ${objectNames.length} files`);
    } catch (error) {
      console.error('Error deleting files:', error);
      throw error;
    }
  }

  /**
   * Lấy presigned URL để download file (URL có thời hạn)
   * @param objectName - Tên object
   * @param expiry - Thời gian hết hạn (seconds), default 7 days
   * @returns URL để download
   */
  public async getPresignedUrl(
    objectName: string,
    expiry: number = 7 * 24 * 60 * 60
  ): Promise<string> {
    try {
      return await this.client.presignedGetObject(
        this.bucketName,
        objectName,
        expiry
      );
    } catch (error) {
      console.error('Error getting presigned URL:', error);
      throw error;
    }
  }

  /**
   * List tất cả files trong bucket
   * @param prefix - Filter theo prefix (optional)
   * @returns Mảng thông tin files
   */
  public async listFiles(params: { prefix?: string }): Promise<Minio.BucketItem[]> {
    try {
      const stream = this.client.listObjects(this.bucketName, params.prefix, true);
      const files: any[] = [];

      return new Promise((resolve, reject) => {
        stream.on('data', (obj) => files.push(obj));
        stream.on('end', () => resolve(files));
        stream.on('error', reject);
      });
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  }

  /**
   * Lấy thông tin chi tiết của file
   * @param objectName - Tên object
   * @returns Thông tin file (size, etag, lastModified, etc.)
   */
  public async getFileInfo(objectName: string): Promise<Minio.BucketItemStat> {
    try {
      return await this.client.statObject(this.bucketName, objectName);
    } catch (error) {
      console.error('Error getting file info:', error);
      throw error;
    }
  }

  /**
   * Check xem file có tồn tại không
   * @param objectName - Tên object
   * @returns true nếu tồn tại, false nếu không
   */
  public async fileExists(objectName: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucketName, objectName);
      return true;
    } catch (error: any) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Đọc Excel file từ MinIO và convert thành array of objects
   * Hàng 1: định nghĩa field names (keys)
   * Hàng 2+: values cho mỗi object
   *
   * @param params.objectName - Tên file trong MinIO
   * @param params.sheetName - Tên sheet (optional, mặc định lấy sheet đầu tiên)
   * @param params.sheetIndex - Index của sheet (optional, mặc định 0)
   * @returns Array of objects
   *
   * @example
   * // Excel file:
   * // | name  | email         | age |
   * // | John  | john@mail.com | 25  |
   * // | Jane  | jane@mail.com | 30  |
   *
   * const data = await minioService.readExcelAsObjects({ objectName: 'data.xlsx' });
   * // Result: [
   * //   { name: "John", email: "john@mail.com", age: 25 },
   * //   { name: "Jane", email: "jane@mail.com", age: 30 }
   * // ]
   */
  public async readExcelAsObjects<T = Record<string, any>>(params: {
    objectName: string;
    sheetName?: string;
    sheetIndex?: number;
  }): Promise<T[]> {
    try {
      const { objectName, sheetName, sheetIndex = 0 } = params;

      console.log(`📊 Reading Excel file: ${objectName}`);

      // 1. Lấy file buffer từ MinIO
      const buffer = await this.getFile({ objectName });

      // 2. Parse Excel file
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      // 3. Lấy sheet
      let sheet: XLSX.WorkSheet;
      if (sheetName) {
        sheet = workbook.Sheets[sheetName];
        if (!sheet) {
          throw new Error(`Sheet "${sheetName}" not found in Excel file`);
        }
      } else {
        const sheetNames = workbook.SheetNames;
        if (sheetIndex >= sheetNames.length) {
          throw new Error(`Sheet index ${sheetIndex} out of range. File has ${sheetNames.length} sheets.`);
        }
        sheet = workbook.Sheets[sheetNames[sheetIndex]];
      }

      // 4. Convert sheet to array of objects
      // header: 1 means row 1 is header (field names)
      const data = XLSX.utils.sheet_to_json<T>(sheet, {
        header: 1, // Get raw arrays first
        defval: null, // Default value for empty cells
      }) as unknown[][];

      if (data.length === 0) {
        console.log(`📊 Excel file is empty`);
        return [];
      }

      // 5. Extract headers (row 1) and data rows (row 2+)
      const headers = data[0] as string[];
      const rows = data.slice(1);

      // 6. Convert to array of objects
      const result: T[] = rows
        .filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== '')) // Skip empty rows
        .map(row => {
          const obj: Record<string, any> = {};
          headers.forEach((header, index) => {
            if (header && header.toString().trim() !== '') {
              const key = header.toString().trim();
              obj[key] = row[index] !== undefined ? row[index] : null;
            }
          });
          return obj as T;
        });

      console.log(`📊 Read ${result.length} rows from Excel file`);
      return result;
    } catch (error) {
      console.error('Error reading Excel file:', error);
      throw error;
    }
  }

  /**
   * Đọc Excel file từ Buffer và convert thành array of objects
   * (Không cần file trong MinIO, truyền buffer trực tiếp)
   *
   * @param params.buffer - Buffer của Excel file
   * @param params.sheetName - Tên sheet (optional)
   * @param params.sheetIndex - Index của sheet (optional, mặc định 0)
   * @returns Array of objects
   */
  public readExcelBufferAsObjects<T = Record<string, any>>(params: {
    buffer: Buffer;
    sheetName?: string;
    sheetIndex?: number;
  }): T[] {
    try {
      const { buffer, sheetName, sheetIndex = 0 } = params;

      // Parse Excel file
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      // Lấy sheet
      let sheet: XLSX.WorkSheet;
      if (sheetName) {
        sheet = workbook.Sheets[sheetName];
        if (!sheet) {
          throw new Error(`Sheet "${sheetName}" not found in Excel file`);
        }
      } else {
        const sheetNames = workbook.SheetNames;
        if (sheetIndex >= sheetNames.length) {
          throw new Error(`Sheet index ${sheetIndex} out of range. File has ${sheetNames.length} sheets.`);
        }
        sheet = workbook.Sheets[sheetNames[sheetIndex]];
      }

      // Convert to raw arrays
      const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: null,
      }) as unknown[][];

      if (data.length === 0) {
        return [];
      }

      // Extract headers and data rows
      const headers = data[0] as string[];
      const rows = data.slice(1);

      // Convert to array of objects
      const result: T[] = rows
        .filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''))
        .map(row => {
          const obj: Record<string, any> = {};
          headers.forEach((header, index) => {
            if (header && header.toString().trim() !== '') {
              const key = header.toString().trim();
              obj[key] = row[index] !== undefined ? row[index] : null;
            }
          });
          return obj as T;
        });

      return result;
    } catch (error) {
      console.error('Error reading Excel buffer:', error);
      throw error;
    }
  }

  /**
   * Lấy danh sách tên các sheets trong Excel file
   * @param params.objectName - Tên file trong MinIO
   * @returns Array of sheet names
   */
  public async getExcelSheetNames(params: { objectName: string }): Promise<string[]> {
    try {
      const buffer = await this.getFile({ objectName: params.objectName });
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      return workbook.SheetNames;
    } catch (error) {
      console.error('Error getting Excel sheet names:', error);
      throw error;
    }
  }

  /**
   * Đọc tất cả sheets trong Excel file
   * @param params.objectName - Tên file trong MinIO
   * @returns Object với key là tên sheet, value là array of objects
   */
  public async readAllExcelSheets<T = Record<string, any>>(params: {
    objectName: string;
  }): Promise<Record<string, T[]>> {
    try {
      const { objectName } = params;

      console.log(`📊 Reading all sheets from Excel file: ${objectName}`);

      const buffer = await this.getFile({ objectName });
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      const result: Record<string, T[]> = {};

      for (const sheetName of workbook.SheetNames) {
        result[sheetName] = this.readExcelBufferAsObjects<T>({
          buffer,
          sheetName,
        });
      }

      console.log(`📊 Read ${Object.keys(result).length} sheets from Excel file`);
      return result;
    } catch (error) {
      console.error('Error reading all Excel sheets:', error);
      throw error;
    }
  }

  /**
   * Normalize data từ database sang Template1Data format
   */
  private normalizeTemplate1Data(data: any): Template1Data {
    // If already in correct format, return as is
    if (data.thesisTitle && data.teachers && data.students &&
        typeof data.teachers[0]?.name === 'string' &&
        typeof data.students[0]?.name === 'string') {
      return data as Template1Data;
    }

    // Map from database format
    return {
      semester: data.semester || '1',
      academicYear: data.academicYear || '2024-2025',

      thesisTitle: {
        vietnamese: data.thesisTitle?.vietnamese || data.major?.title || 'Chưa có tên đề tài',
        english: data.thesisTitle?.english || data.major?.title || 'No thesis title',
      },

      company: data.company ? {
        name: data.company.name || '',
        address: data.company.address || '',
        websiteLink: data.company.websiteLink || '',
        representativeName: data.company.representativeName || '',
      } : undefined,

      // Map teachers from database format (có thể là array of teacher objects)
      teachers: (data.teachers || []).map((t: any) => ({
        name: t.name || t.username || t.id || 'Chưa có tên',
        email: t.email || '',
      })),

      // Map students from database format
      students: (data.students || []).map((s: any) => ({
        name: s.name || s.username || s.id || 'Chưa có tên',
        studentId: s.studentId || s.id || '',
        program: s.program || data.programType || 'CQ',
      })),

      // Map major
      major: data.major?.title || data.major || 'Khoa học máy tính',

      programLanguage: data.programLanguage || 'Tiếng Việt',
      programType: data.programType || 'CQ',

      description: data.description || '',
    };
  }

  /**
   * Tạo PDF từ Template 1 data và trả về Buffer
   * @param data - Data cho template 1 (có thể là Template1Data hoặc raw data từ DB)
   * @returns Promise<Buffer> - PDF buffer
   */
  public async generateTemplate1PDF(data: any): Promise<Buffer> {
    console.log('Generating PDF for Template 1...', data);

    // Normalize data to Template1Data format
    const normalizedData: Template1Data = this.normalizeTemplate1Data(data);
    console.log('Normalized data:', normalizedData);

    // Lưu description để render sau với Puppeteer
    const descriptionHtml = normalizedData.description;
    // Tạm thời remove description để render PDF chính trước
    const dataWithoutDescription = { ...normalizedData, description: '' };

    return new Promise(async (resolve, reject) => {
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
        doc.on('end', async () => {
          try {
            const mainPdfBuffer = Buffer.concat(chunks);
            
            // Nếu có description, render với Puppeteer
            if (descriptionHtml) {
              const descriptionPdf = await renderHtmlDescriptionToPdf(descriptionHtml);
              
              if (descriptionPdf) {
                // Merge 2 PDF bằng cách append description PDF vào cuối
                try {
                  const merged = await this.mergePdfBuffers(mainPdfBuffer, descriptionPdf);
                  resolve(merged);
                  return;
                } catch (mergeError) {
                  console.warn('Could not merge PDFs, using fallback method:', mergeError);
                  // Fallback: generate lại PDF với description bằng PDFGenerator parser
                  const fallbackPdf = await this.generateWithDescriptionFallback(normalizedData);
                  resolve(fallbackPdf);
                  return;
                }
              }
            }
            
            // Không có description hoặc Puppeteer không available
            resolve(mainPdfBuffer);
          } catch (error) {
            reject(error);
          }
        });
        doc.on('error', reject);

        // Generate PDF content (không có description)
        this.renderTemplate1(doc, dataWithoutDescription);

        // Finalize PDF
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Merge 2 PDF buffers bằng cách tạo PDF mới và copy pages (sử dụng pdf-lib nếu có)
   */
  private async mergePdfBuffers(pdf1Buffer: Buffer, pdf2Buffer: Buffer): Promise<Buffer> {
    try {
      // Thử dùng pdf-lib nếu có (dynamic require để tránh lỗi compile)
      let PDFDocument: any;
      try {
        const pdfLib = require('pdf-lib');
        PDFDocument = pdfLib.PDFDocument;
      } catch {
        throw new Error('pdf-lib not installed');
      }
      
      if (!PDFDocument) {
        throw new Error('pdf-lib not available');
      }
      
      const mergedPdf = await PDFDocument.create();
      
      // Load và copy pages từ PDF 1
      const pdf1 = await PDFDocument.load(pdf1Buffer);
      const pdf1Pages = await mergedPdf.copyPages(pdf1, pdf1.getPageIndices());
      pdf1Pages.forEach((page: any) => mergedPdf.addPage(page));
      
      // Load và copy pages từ PDF 2
      const pdf2 = await PDFDocument.load(pdf2Buffer);
      const pdf2Pages = await mergedPdf.copyPages(pdf2, pdf2.getPageIndices());
      pdf2Pages.forEach((page: any) => mergedPdf.addPage(page));
      
      // Save merged PDF
      const mergedBytes = await mergedPdf.save();
      return Buffer.from(mergedBytes);
    } catch (error: any) {
      // pdf-lib không có, throw error để fallback
      throw new Error('pdf-lib is required for merging PDFs. Install it: npm install pdf-lib');
    }
  }

  /**
   * Fallback: Generate PDF với description bằng PDFGenerator parser
   */
  private async generateWithDescriptionFallback(data: Template1Data): Promise<Buffer> {
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

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Render PDF chính
        const dataWithoutDescription = { ...data, description: '' };
        this.renderTemplate1(doc, dataWithoutDescription);
        
        // Render description với PDFGenerator parser
        if (data.description) {
          doc.fontSize(12).font('Regular');
          const { PDFGenerator } = require('./pdf-generator');
          const pdfGenerator = new PDFGenerator();
          pdfGenerator.renderHtmlToPdf(doc, data.description);
        }

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
      .text(`${data.semester.toUpperCase()}`, { align: 'center' })
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

    majorsList.forEach((m) => {
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

    programsList.forEach((p) => {
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

    // Mô tả - sẽ được render với Puppeteer sau khi PDF chính được tạo
  }
}
