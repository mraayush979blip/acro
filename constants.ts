
import { Branch, Batch, Subject, User, UserRole, FacultyAssignment } from './types';

export const SEED_BRANCHES: Branch[] = [
  { id: 'b_cse', name: 'Computer Science (CSE)' },
  { id: 'b_aiml', name: 'AI & ML (AIML)' },
  { id: 'b_ece', name: 'Electronics (ECE)' }
];

export const SEED_BATCHES: Batch[] = [
  { id: 'batch_cse_2_a', name: 'CSE Year 2 - Batch A', branchId: 'b_cse' },
  { id: 'batch_cse_2_b', name: 'CSE Year 2 - Batch B', branchId: 'b_cse' },
  { id: 'batch_aiml_2_a', name: 'AIML Year 2 - Batch A', branchId: 'b_aiml' }
];

export const SEED_SUBJECTS: Subject[] = [
  { id: 'sub_math', name: 'Engineering Mathematics', code: 'M101' },
  { id: 'sub_ds', name: 'Data Structures', code: 'CS201' },
  { id: 'sub_network', name: 'Computer Networks', code: 'CS304' }
];

export const SEED_USERS: User[] = [
  {
    uid: 'admin_1',
    email: 'hod@acropolis.in',
    displayName: 'Admin HOD',
    role: UserRole.ADMIN
  },
  {
    uid: 'stu_1',
    email: 'student@acropolis.in',
    displayName: 'Rahul Singh',
    role: UserRole.STUDENT,
    studentData: {
      branchId: 'b_cse',
      batchId: 'batch_cse_2_a',
      enrollmentId: '0827CS211001'
    }
  },
  {
    uid: 'stu_2',
    email: 'priya@acropolis.in',
    displayName: 'Priya Patel',
    role: UserRole.STUDENT,
    studentData: {
      branchId: 'b_cse',
      batchId: 'batch_cse_2_a',
      enrollmentId: '0827CS211002'
    }
  }
];

// Initial assignments
export const SEED_ASSIGNMENTS: FacultyAssignment[] = [
  {
    id: 'assign_1',
    facultyId: 'fac_1',
    branchId: 'b_cse',
    batchId: 'batch_cse_2_a',
    subjectId: 'sub_ds'
  },
  {
    id: 'assign_2',
    facultyId: 'fac_1',
    branchId: 'b_cse',
    batchId: 'ALL', 
    subjectId: 'sub_network'
  }
];
