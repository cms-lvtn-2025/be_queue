/**
 * Interface cho data template 1
 * Template: Thông tin đề tài - Giai đoạn 1
 */

export interface StudentInfo {
  name: string;        // Tên sinh viên
  studentId: string;   // Mã số sinh viên
  program: string;     // Chương trình đào tạo (CQ/CN/B2/SN/VLVH/TX/CC/CT/QT)
}

export interface TeacherInfo {
  name: string;        // Họ tên CBHD
  email: string;       // Email CBHD
}

export interface CompanyInfo {
  name: string;              // Tên công ty/doanh nghiệp
  address: string;           // Địa chỉ
  websiteLink: string;       // Website link
  representativeName: string; // Người đại diện
}

export enum Major {
  CS = 'Khoa học máy tính',
  CE = 'Kỹ thuật máy tính',
  CS_CE = 'Liên ngành CS-CE'
}

export enum ProgramLanguage {
  VIETNAMESE = 'Tiếng Việt',
  ENGLISH = 'Tiếng Anh'
}

export interface Template1Data {
  // Học kỳ và năm học
  semester: string;           // Học kỳ (ví dụ: "1", "2", "Hè")
  academicYear: string;       // Năm học (ví dụ: "2024-2025")

  // Thông tin đề tài
  thesisTitle: {
    vietnamese: string;       // Tên đề tài tiếng Việt
    english: string;          // Tên đề tài tiếng Anh
  };

  // Thông tin công ty (optional)
  company?: CompanyInfo;

  // Thông tin cán bộ hướng dẫn
  teachers: TeacherInfo[];    // Mảng CBHD (có thể nhiều người)

  // Thông tin sinh viên
  students: StudentInfo[];    // Mảng sinh viên (1-3 người)

  // Ngành và chương trình
  major: Major;               // Ngành học
  programLanguage: ProgramLanguage; // Chương trình đào tạo
  programType?: string;       // Loại chương trình cụ thể (CQ/CN/CC/CT...)

  // Mô tả chi tiết
  description: string;        // Mô tả phía dưới đây
}
