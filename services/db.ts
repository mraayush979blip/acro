import { initializeApp, deleteApp, FirebaseApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, User as FirebaseUser } from "firebase/auth";
import { getFirestore, collection, getDocs, doc, setDoc, query, where, addDoc, deleteDoc, getDoc, writeBatch, updateDoc } from "firebase/firestore";
import { User, Branch, Batch, Subject, FacultyAssignment, AttendanceRecord, UserRole } from "../types";
import { SEED_BRANCHES, SEED_BATCHES, SEED_SUBJECTS, SEED_USERS, SEED_ASSIGNMENTS } from "../constants";

// --- Configuration ---
// Configured for Project ID: acropolis-7d028
const firebaseConfig = {
  apiKey: "AIzaSyCdpI72dXZU9ZgDi9rNMsThEym7EYJfuq4",
  authDomain: "acropolis-7d028.firebaseapp.com",
  projectId: "acropolis-7d028",
  storageBucket: "acropolis-7d028.firebasestorage.app",
  messagingSenderId: "917626092892",
  appId: "1:917626092892:web:33637e585e836eeb771599"
};

// Initialize Firebase (Primary App)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);

// --- Service Interface ---
interface IDataService {
  login: (email: string, pass: string) => Promise<User>;
  logout: () => Promise<void>;
  getCurrentUser: () => Promise<User | null>;
  
  // Hierarchy
  getBranches: () => Promise<Branch[]>;
  addBranch: (name: string) => Promise<void>;
  deleteBranch: (id: string) => Promise<void>;
  
  getBatches: (branchId: string) => Promise<Batch[]>;
  addBatch: (name: string, branchId: string) => Promise<void>;
  deleteBatch: (id: string) => Promise<void>;
  
  // Users
  getStudents: (branchId: string, batchId: string) => Promise<User[]>;
  createStudent: (data: Partial<User>) => Promise<void>;
  importStudents: (students: Partial<User>[]) => Promise<void>;
  deleteUser: (uid: string) => Promise<void>;
  
  getSubjects: () => Promise<Subject[]>;
  addSubject: (name: string, code: string) => Promise<void>;
  updateSubject: (id: string, name: string, code: string) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  
  getFaculty: () => Promise<User[]>;
  createFaculty: (data: Partial<User>, password?: string) => Promise<void>;
  getAssignments: (facultyId?: string) => Promise<FacultyAssignment[]>;
  assignFaculty: (data: Omit<FacultyAssignment, 'id'>) => Promise<void>;
  removeAssignment: (id: string) => Promise<void>;
  
  // Attendance
  getAttendance: (branchId: string, batchId: string, subjectId: string, date?: string) => Promise<AttendanceRecord[]>;
  getStudentAttendance: (studentId: string) => Promise<AttendanceRecord[]>;
  saveAttendance: (records: AttendanceRecord[]) => Promise<void>;
  
  // Setup
  seedDatabase: () => Promise<void>;
}

// --- Firebase Implementation ---
class FirebaseService implements IDataService {
  
  // Helper: Create Auth user without logging out the admin
  // We use a secondary app instance to handle the creation
  private async createAuthUser(email: string, pass: string = "password123"): Promise<string> {
    let secondApp: FirebaseApp | null = null;
    try {
      // Initialize a secondary app instance
      secondApp = initializeApp(firebaseConfig, "SecondaryApp");
      const secondAuth = getAuth(secondApp);
      
      // Create the user on the secondary instance
      const cred = await createUserWithEmailAndPassword(secondAuth, email, pass);
      
      // Sign out immediately from the secondary instance to be safe
      await signOut(secondAuth);
      
      return cred.user.uid;
    } catch (e: any) {
      if (e.code === 'auth/email-already-in-use') {
        throw new Error(`Email ${email} is already in use. Please check Firebase Console or delete the user manually if re-adding.`);
      }
      throw e;
    } finally {
      // Clean up the secondary app instance
      if (secondApp) {
        await deleteApp(secondApp);
      }
    }
  }

  async login(email: string, pass: string): Promise<User> {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const uid = cred.user.uid;
    
    // Check for user profile in Firestore
    let userDoc = await getDoc(doc(firestore, "users", uid));
    
    // DEMO HELPER: If Auth User exists but Firestore profile doesn't (e.g. manually created in console),
    // try to find a seeded profile with the same email and link it to this new UID.
    if (!userDoc.exists()) {
       const q = query(collection(firestore, "users"), where("email", "==", email));
       const snapshot = await getDocs(q);
       if (!snapshot.empty) {
         const oldData = snapshot.docs[0].data();
         // Create the correct profile linked to the real Auth UID
         await setDoc(doc(firestore, "users", uid), { ...oldData, uid });
         userDoc = await getDoc(doc(firestore, "users", uid));
       }
    }

    if (userDoc.exists()) {
      return userDoc.data() as User;
    }
    
    throw new Error("Profile not found in Database. Please click 'Initialize Database' in the Admin panel or ensure data is seeded.");
  }

  async logout(): Promise<void> {
    await signOut(auth);
  }

  async getCurrentUser(): Promise<User | null> {
    return new Promise((resolve) => {
       const unsubscribe = auth.onAuthStateChanged(async (u) => {
         unsubscribe();
         if (u) {
           const docRef = await getDoc(doc(firestore, "users", u.uid));
           if (docRef.exists()) {
             resolve(docRef.data() as User);
           } else {
             resolve(null);
           }
         } else {
           resolve(null);
         }
       });
    });
  }

  // --- Hierarchy ---
  async getBranches(): Promise<Branch[]> {
    const snap = await getDocs(collection(firestore, "branches"));
    return snap.docs.map(d => d.data() as Branch);
  }

  async addBranch(name: string): Promise<void> {
    const ref = doc(collection(firestore, "branches"));
    await setDoc(ref, { id: ref.id, name });
  }

  async deleteBranch(id: string): Promise<void> {
    await deleteDoc(doc(firestore, "branches", id));
  }

  async getBatches(branchId: string): Promise<Batch[]> {
    const q = query(collection(firestore, "batches"), where("branchId", "==", branchId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Batch);
  }

  async addBatch(name: string, branchId: string): Promise<void> {
    const ref = doc(collection(firestore, "batches"));
    await setDoc(ref, { id: ref.id, name, branchId });
  }

  async deleteBatch(id: string): Promise<void> {
    await deleteDoc(doc(firestore, "batches", id));
  }

  // --- Users ---
  async getStudents(branchId: string, batchId: string): Promise<User[]> {
    // Note: In production, requires composite index. For demo, we filter in memory to save setup time.
    const q = query(collection(firestore, "users"), where("role", "==", UserRole.STUDENT));
    const snap = await getDocs(q);
    const allStudents = snap.docs.map(d => d.data() as User);
    return allStudents.filter(s => s.studentData?.branchId === branchId && s.studentData?.batchId === batchId);
  }

  async createStudent(data: Partial<User>): Promise<void> {
    if (!data.email) throw new Error("Email is required");
    
    // Default password is Enrollment ID, fallback to password123 if missing
    const password = data.studentData?.enrollmentId || "password123";
    
    // 1. Create Auth User (Real)
    const newUid = await this.createAuthUser(data.email, password);
    
    // 2. Create Firestore Profile with matching UID
    const ref = doc(firestore, "users", newUid);
    await setDoc(ref, { ...data, uid: newUid, role: UserRole.STUDENT });
  }

  async importStudents(students: Partial<User>[]): Promise<void> {
    // We must do this sequentially to handle the Auth creation safely
    // In a real app, this should be a Cloud Function to run faster and cleaner
    for (const s of students) {
      if (s.email) {
        try {
          const password = s.studentData?.enrollmentId || "password123";
          
          // 1. Create Auth
          const newUid = await this.createAuthUser(s.email, password);
          
          // 2. Create Profile
          const ref = doc(firestore, "users", newUid);
          await setDoc(ref, { ...s, uid: newUid, role: UserRole.STUDENT });
        } catch (e) {
          console.error(`Failed to import student ${s.email}:`, e);
          // Continue to next student even if one fails
        }
      }
    }
  }

  async deleteUser(uid: string): Promise<void> {
    // Note: Client SDK cannot delete Auth users easily without being logged in as them.
    // This only deletes the profile. Admin must manually delete from Console to fully cleanup.
    await deleteDoc(doc(firestore, "users", uid));
  }

  async getFaculty(): Promise<User[]> {
    const q = query(collection(firestore, "users"), where("role", "==", UserRole.FACULTY));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as User);
  }

  async createFaculty(data: Partial<User>, password?: string): Promise<void> {
    if (!data.email) throw new Error("Email is required");
    
    // 1. Create Auth User
    const pass = password || "password123";
    const newUid = await this.createAuthUser(data.email, pass);

    // 2. Create Profile
    const ref = doc(firestore, "users", newUid);
    await setDoc(ref, { ...data, uid: newUid, role: UserRole.FACULTY });
  }

  // --- Subjects & Assignments ---
  async getSubjects(): Promise<Subject[]> {
    const snap = await getDocs(collection(firestore, "subjects"));
    return snap.docs.map(d => d.data() as Subject);
  }

  async addSubject(name: string, code: string): Promise<void> {
    const ref = doc(collection(firestore, "subjects"));
    await setDoc(ref, { id: ref.id, name, code });
  }

  async updateSubject(id: string, name: string, code: string): Promise<void> {
    const ref = doc(firestore, "subjects", id);
    await updateDoc(ref, { name, code });
  }

  async deleteSubject(id: string): Promise<void> {
    await deleteDoc(doc(firestore, "subjects", id));
  }

  async getAssignments(facultyId?: string): Promise<FacultyAssignment[]> {
    let q = query(collection(firestore, "assignments"));
    if (facultyId) {
      q = query(collection(firestore, "assignments"), where("facultyId", "==", facultyId));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as FacultyAssignment);
  }

  async assignFaculty(data: Omit<FacultyAssignment, 'id'>): Promise<void> {
    const ref = doc(collection(firestore, "assignments"));
    await setDoc(ref, { ...data, id: ref.id });
  }

  async removeAssignment(id: string): Promise<void> {
    await deleteDoc(doc(firestore, "assignments", id));
  }

  // --- Attendance ---
  async getAttendance(branchId: string, batchId: string, subjectId: string, date?: string): Promise<AttendanceRecord[]> {
    // Client-side filtering to avoid complex index requirements for the demo
    const q = query(collection(firestore, "attendance"), where("subjectId", "==", subjectId));
    const snap = await getDocs(q);
    let records = snap.docs.map(d => d.data() as AttendanceRecord);
    
    return records.filter(r => 
      r.branchId === branchId && 
      r.batchId === batchId && 
      (!date || r.date === date)
    );
  }

  async getStudentAttendance(studentId: string): Promise<AttendanceRecord[]> {
    const q = query(collection(firestore, "attendance"), where("studentId", "==", studentId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as AttendanceRecord);
  }

  async saveAttendance(records: AttendanceRecord[]): Promise<void> {
    const batch = writeBatch(firestore);
    records.forEach(rec => {
      const ref = doc(firestore, "attendance", rec.id);
      batch.set(ref, rec);
    });
    await batch.commit();
  }

  // --- Setup ---
  async seedDatabase(): Promise<void> {
    const batch = writeBatch(firestore);
    
    // Seed Branches
    SEED_BRANCHES.forEach(b => {
      batch.set(doc(firestore, "branches", b.id), b);
    });
    
    // Seed Batches
    SEED_BATCHES.forEach(b => {
      batch.set(doc(firestore, "batches", b.id), b);
    });
    
    // Seed Subjects
    SEED_SUBJECTS.forEach(s => {
      batch.set(doc(firestore, "subjects", s.id), s);
    });
    
    // Seed Users
    SEED_USERS.forEach(u => {
      // For seeding, we use the hardcoded UIDs from constants, 
      // but logic in login() will map real Auth UIDs to these emails.
      batch.set(doc(firestore, "users", u.uid), u);
    });

    // Seed Assignments
    SEED_ASSIGNMENTS.forEach(a => {
      batch.set(doc(firestore, "assignments", a.id), a);
    });

    await batch.commit();
    alert("Database seeded! You can now create auth users matching these emails.");
  }
}

// --- MOCK Implementation (Fallback) ---
class MockService implements IDataService {
  private simulateDelay = () => new Promise(resolve => setTimeout(resolve, 300));
  private load(key: string, seed: any[]): any[] {
    const data = localStorage.getItem(key);
    if (!data) {
      localStorage.setItem(key, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(data);
  }
  private save(key: string, data: any[]) {
    localStorage.setItem(key, JSON.stringify(data));
  }
  constructor() {
    this.seedDatabase(); // Auto-seed mock
  }
  async login(email: string, pass: string): Promise<User> {
    await this.simulateDelay();
    const users = this.load('ams_users', SEED_USERS) as User[];
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (user) {
      localStorage.setItem('ams_current_user', JSON.stringify(user));
      return user;
    }
    throw new Error("Invalid credentials");
  }
  async logout(): Promise<void> {
    localStorage.removeItem('ams_current_user');
  }
  async getCurrentUser(): Promise<User | null> {
    const data = localStorage.getItem('ams_current_user');
    return data ? JSON.parse(data) : null;
  }
  async getBranches(): Promise<Branch[]> {
    await this.simulateDelay();
    return this.load('ams_branches', SEED_BRANCHES);
  }
  async addBranch(name: string): Promise<void> {
    const branches = await this.getBranches();
    branches.push({ id: `b_${Date.now()}`, name });
    this.save('ams_branches', branches);
  }
  async deleteBranch(id: string): Promise<void> {
    const branches = await this.getBranches();
    this.save('ams_branches', branches.filter(b => b.id !== id));
  }
  async getBatches(branchId: string): Promise<Batch[]> {
    await this.simulateDelay();
    const batches = this.load('ams_batches', SEED_BATCHES) as Batch[];
    return batches.filter(b => b.branchId === branchId);
  }
  async addBatch(name: string, branchId: string): Promise<void> {
    const batches = this.load('ams_batches', SEED_BATCHES);
    batches.push({ id: `batch_${Date.now()}`, name, branchId });
    this.save('ams_batches', batches);
  }
  async deleteBatch(id: string): Promise<void> {
    const batches = this.load('ams_batches', SEED_BATCHES);
    this.save('ams_batches', batches.filter((b: Batch) => b.id !== id));
  }
  async getStudents(branchId: string, batchId: string): Promise<User[]> {
    await this.simulateDelay();
    const users = this.load('ams_users', SEED_USERS) as User[];
    return users.filter(u => u.role === UserRole.STUDENT && u.studentData?.branchId === branchId && u.studentData?.batchId === batchId);
  }
  async createStudent(data: Partial<User>): Promise<void> {
    const users = this.load('ams_users', SEED_USERS);
    users.push({ ...data, uid: `stu_${Date.now()}`, role: UserRole.STUDENT });
    this.save('ams_users', users);
  }
  async importStudents(students: Partial<User>[]): Promise<void> {
    const users = this.load('ams_users', SEED_USERS);
    students.forEach((s, idx) => {
      users.push({ ...s, uid: `stu_${Date.now()}_${idx}`, role: UserRole.STUDENT });
    });
    this.save('ams_users', users);
  }
  async deleteUser(uid: string): Promise<void> {
    // Delete user
    const users = this.load('ams_users', SEED_USERS);
    this.save('ams_users', users.filter((u: User) => u.uid !== uid));
  }
  async getSubjects(): Promise<Subject[]> {
    await this.simulateDelay();
    return this.load('ams_subjects', SEED_SUBJECTS);
  }
  async addSubject(name: string, code: string): Promise<void> {
    const subs = this.load('ams_subjects', SEED_SUBJECTS);
    subs.push({ id: `sub_${Date.now()}`, name, code });
    this.save('ams_subjects', subs);
  }
  async updateSubject(id: string, name: string, code: string): Promise<void> {
    const subs = this.load('ams_subjects', SEED_SUBJECTS);
    const idx = subs.findIndex((s: Subject) => s.id === id);
    if (idx !== -1) {
      subs[idx] = { ...subs[idx], name, code };
      this.save('ams_subjects', subs);
    }
  }
  async deleteSubject(id: string): Promise<void> {
    const subs = this.load('ams_subjects', SEED_SUBJECTS);
    this.save('ams_subjects', subs.filter((s: Subject) => s.id !== id));
  }
  async getFaculty(): Promise<User[]> {
    const users = this.load('ams_users', SEED_USERS) as User[];
    return users.filter(u => u.role === UserRole.FACULTY);
  }
  async createFaculty(data: Partial<User>, password?: string): Promise<void> {
    const users = this.load('ams_users', SEED_USERS);
    users.push({ ...data, uid: `fac_${Date.now()}`, role: UserRole.FACULTY });
    this.save('ams_users', users);
  }
  async getAssignments(facultyId?: string): Promise<FacultyAssignment[]> {
    const assigns = this.load('ams_assignments', SEED_ASSIGNMENTS) as FacultyAssignment[];
    if (facultyId) return assigns.filter(a => a.facultyId === facultyId);
    return assigns;
  }
  async assignFaculty(data: Omit<FacultyAssignment, 'id'>): Promise<void> {
    const assigns = this.load('ams_assignments', SEED_ASSIGNMENTS);
    assigns.push({ ...data, id: `assign_${Date.now()}` });
    this.save('ams_assignments', assigns);
  }
  async removeAssignment(id: string): Promise<void> {
    const assigns = this.load('ams_assignments', SEED_ASSIGNMENTS);
    this.save('ams_assignments', assigns.filter((a: FacultyAssignment) => a.id !== id));
  }
  async getAttendance(branchId: string, batchId: string, subjectId: string, date?: string): Promise<AttendanceRecord[]> {
    const all = this.load('ams_attendance', []) as AttendanceRecord[];
    return all.filter(a => 
      a.branchId === branchId && 
      a.batchId === batchId && 
      a.subjectId === subjectId &&
      (!date || a.date === date)
    );
  }
  async getStudentAttendance(studentId: string): Promise<AttendanceRecord[]> {
    const all = this.load('ams_attendance', []) as AttendanceRecord[];
    return all.filter(a => a.studentId === studentId);
  }
  async saveAttendance(records: AttendanceRecord[]): Promise<void> {
    const all = this.load('ams_attendance', []) as AttendanceRecord[];
    if (records.length > 0) {
      const sample = records[0];
      const filtered = all.filter(a => 
        !(a.date === sample.date && a.subjectId === sample.subjectId && a.batchId === sample.batchId)
      );
      const combined = [...filtered, ...records];
      this.save('ams_attendance', combined);
    }
  }
  async seedDatabase(): Promise<void> {
    if (!localStorage.getItem('ams_users')) {
      this.load('ams_branches', SEED_BRANCHES);
      this.load('ams_batches', SEED_BATCHES);
      this.load('ams_subjects', SEED_SUBJECTS);
      this.load('ams_users', SEED_USERS);
      this.load('ams_assignments', SEED_ASSIGNMENTS);
    }
  }
}

// --- Export ---
// Check if Firebase config has a valid API key (either from env or hardcoded).
const hasFirebaseKey = firebaseConfig.apiKey && firebaseConfig.apiKey.length > 0 && !firebaseConfig.apiKey.includes('mock');

export const db = hasFirebaseKey ? new FirebaseService() : new MockService();