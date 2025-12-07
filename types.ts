
export enum UserRole {
  ADMIN = 'ADMIN',
  FACULTY = 'FACULTY',
  STUDENT = 'STUDENT'
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  studentData?: {
    branchId: string;
    batchId: string;
    enrollmentId: string;
    rollNo?: string;
  };
}

export interface Branch {
  id: string;
  name: string;
}

export interface Batch {
  id: string;
  name: string;
  branchId: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
}

// Links a faculty member to a specific class context
export interface FacultyAssignment {
  id: string;
  facultyId: string;
  branchId: string;
  batchId: string; // 'ALL' or specific batchId
  subjectId: string;
}

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  studentId: string;
  subjectId: string;
  branchId: string;
  batchId: string;
  isPresent: boolean;
  markedBy: string; // Faculty UID
  timestamp: number;
  lectureSlot?: number; // 1 to 7
}
