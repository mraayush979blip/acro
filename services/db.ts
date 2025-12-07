
import { initializeApp, deleteApp, FirebaseApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, updatePassword, reauthenticateWithCredential, EmailAuthProvider, User as FirebaseUser } from "firebase/auth";
import { getFirestore, collection, getDocs, doc, setDoc, query, where, addDoc, deleteDoc, getDoc, writeBatch, updateDoc } from "firebase/firestore";
import { User, Branch, Batch, Subject, FacultyAssignment, AttendanceRecord, UserRole } from "../types";
import { SEED_BRANCHES, SEED_BATCHES, SEED_SUBJECTS, SEED_USERS, SEED_ASSIGNMENTS } from "../constants";

// --- Configuration ---
const firebaseConfig = {
  apiKey:  "AIzaSyCdpI72dXZU9ZgDi9rNMsThEym7EYJfuq4",
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
  changePassword: (currentPass: string, newPass: string) => Promise<void>;
  
  // Hierarchy
  getBranches: () => Promise<Branch[]>;
  addBranch: (name: string) => Promise<void>;
  deleteBranch: (id: string) => Promise<void>;
  
  getBatches: (branchId: string) => Promise<Batch[]>; // Updated: by branchId
  addBatch: (name: string, branchId: string) => Promise<void>; // Updated: by branchId
  deleteBatch: (id: string) => Promise<void>;
  
  // Users
  getStudents: (branchId: string, batchId?: string) => Promise<User[]>; // Updated
  createStudent: (data: Partial<User>) => Promise<void>;
  importStudents: (students: Partial<User>[]) => Promise<void>;
  deleteUser: (uid: string) => Promise<void>;
  
  getSubjects: () => Promise<Subject[]>;
  addSubject: (name: string, code: string) => Promise<void>;
  updateSubject: (id: string, name: string, code: string) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  
  getFaculty: () => Promise<User[]>;
  createFaculty: (data: Partial<User>, password?: string) => Promise<void>;
  resetFacultyPassword: (uid: string, newPass: string) => Promise<void>;
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
  
  private async createAuthUser(email: string, pass: string = "password123"): Promise<string> {
    let secondApp: FirebaseApp | null = null;
    try {
      secondApp = initializeApp(firebaseConfig, "SecondaryApp");
      const secondAuth = getAuth(secondApp);
      const cred = await createUserWithEmailAndPassword(secondAuth, email, pass);
      await signOut(secondAuth);
      return cred.user.uid;
    } catch (e: any) {
      if (e.code === 'auth/email-already-in-use') {
        throw new Error(`Email ${email} is already in use.`);
      }
      throw e;
    } finally {
      if (secondApp) await deleteApp(secondApp);
    }
  }

  async login(email: string, pass: string): Promise<User> {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const uid = cred.user.uid;
    let userDoc = await getDoc(doc(firestore, "users", uid));
    
    if (!userDoc.exists()) {
       const q = query(collection(firestore, "users"), where("email", "==", email));
       const snapshot = await getDocs(q);
       if (!snapshot.empty) {
         const oldData = snapshot.docs[0].data();
         await setDoc(doc(firestore, "users", uid), { ...oldData, uid });
         userDoc = await getDoc(doc(firestore, "users", uid));
       } else if (email === 'hod@acropolis.in') {
         return {
           uid: uid,
           email: email,
           displayName: "Admin (Bootstrap)",
           role: UserRole.ADMIN
         };
       }
    }
    
    if (userDoc.exists()) return userDoc.data() as User;
    throw new Error("Profile not found. Please contact support.");
  }

  async logout(): Promise<void> { await signOut(auth); }

  async getCurrentUser(): Promise<User | null> {
    return new Promise((resolve) => {
       const unsubscribe = auth.onAuthStateChanged(async (u) => {
         unsubscribe();
         if (u) {
           const docRef = await getDoc(doc(firestore, "users", u.uid));
           if (docRef.exists()) {
             resolve(docRef.data() as User);
           } else if (u.email === 'hod@acropolis.in') {
             resolve({
                uid: u.uid,
                email: u.email!,
                displayName: "Admin (Bootstrap)",
                role: UserRole.ADMIN
             });
           } else {
             resolve(null);
           }
         } else resolve(null);
       });
    });
  }

  async changePassword(currentPass: string, newPass: string): Promise<void> {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error("No authenticated user.");
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPass);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPass);
    } catch (e: any) {
      if (e.code === 'auth/wrong-password') throw new Error("Incorrect password.");
      throw e;
    }
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
  async deleteBranch(id: string): Promise<void> { await deleteDoc(doc(firestore, "branches", id)); }

  async getBatches(branchId: string): Promise<Batch[]> {
    const q = query(collection(firestore, "batches"), where("branchId", "==", branchId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Batch);
  }
  async addBatch(name: string, branchId: string): Promise<void> {
    const ref = doc(collection(firestore, "batches"));
    await setDoc(ref, { id: ref.id, name, branchId });
  }
  async deleteBatch(id: string): Promise<void> { await deleteDoc(doc(firestore, "batches", id)); }

  // --- Users ---
  async getStudents(branchId: string, batchId?: string): Promise<User[]> {
    const q = query(collection(firestore, "users"), where("role", "==", UserRole.STUDENT));
    const snap = await getDocs(q);
    const all = snap.docs.map(d => d.data() as User);
    
    // Filter by Branch
    let filtered = all.filter(s => s.studentData?.branchId === branchId);

    // If batchId is provided (or not ALL), filter strict. If ALL, filter by branch only.
    if (batchId && batchId !== 'ALL') {
        filtered = filtered.filter(s => s.studentData?.batchId === batchId);
    }
    return filtered;
  }

  async createStudent(data: Partial<User>): Promise<void> {
    if (!data.email) throw new Error("Email is required");
    const password = data.studentData?.enrollmentId || "password123";
    const newUid = await this.createAuthUser(data.email, password);
    const ref = doc(firestore, "users", newUid);
    await setDoc(ref, { ...data, uid: newUid, role: UserRole.STUDENT });
  }

  async importStudents(students: Partial<User>[]): Promise<void> {
    for (const s of students) {
      if (s.email) {
        try {
          const password = s.studentData?.enrollmentId || "password123";
          const newUid = await this.createAuthUser(s.email, password);
          const ref = doc(firestore, "users", newUid);
          await setDoc(ref, { ...s, uid: newUid, role: UserRole.STUDENT });
        } catch (e) { console.error(`Import failed for ${s.email}`, e); }
      }
    }
  }

  async deleteUser(uid: string): Promise<void> { await deleteDoc(doc(firestore, "users", uid)); }

  async getFaculty(): Promise<User[]> {
    const q = query(collection(firestore, "users"), where("role", "==", UserRole.FACULTY));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as User);
  }

  async createFaculty(data: Partial<User>, password?: string): Promise<void> {
    if (!data.email) throw new Error("Email is required");
    const pass = password || "password123";
    const newUid = await this.createAuthUser(data.email, pass);
    const ref = doc(firestore, "users", newUid);
    await setDoc(ref, { ...data, uid: newUid, role: UserRole.FACULTY });
  }

  async resetFacultyPassword(uid: string, newPass: string): Promise<void> {
    const userRef = doc(firestore, "users", uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error("User not found");
    const userData = userSnap.data() as User;
    let newUid;
    try {
      newUid = await this.createAuthUser(userData.email, newPass);
    } catch (e: any) {
      if (e.message && e.message.includes("already in use")) throw new Error("Please delete user from Firebase Console first.");
      throw e;
    }
    const batch = writeBatch(firestore);
    batch.set(doc(firestore, "users", newUid), { ...userData, uid: newUid });
    const q = query(collection(firestore, "assignments"), where("facultyId", "==", uid));
    const assigns = await getDocs(q);
    assigns.forEach(a => batch.update(a.ref, { facultyId: newUid }));
    batch.delete(userRef);
    await batch.commit();
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
  async deleteSubject(id: string): Promise<void> { await deleteDoc(doc(firestore, "subjects", id)); }

  async getAssignments(facultyId?: string): Promise<FacultyAssignment[]> {
    let q = query(collection(firestore, "assignments"));
    if (facultyId) q = query(collection(firestore, "assignments"), where("facultyId", "==", facultyId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as FacultyAssignment);
  }
  async assignFaculty(data: Omit<FacultyAssignment, 'id'>): Promise<void> {
    const ref = doc(collection(firestore, "assignments"));
    await setDoc(ref, { ...data, id: ref.id });
  }
  async removeAssignment(id: string): Promise<void> { await deleteDoc(doc(firestore, "assignments", id)); }

  // --- Attendance ---
  async getAttendance(branchId: string, batchId: string, subjectId: string, date?: string): Promise<AttendanceRecord[]> {
    const q = query(collection(firestore, "attendance"), where("subjectId", "==", subjectId));
    const snap = await getDocs(q);
    let records = snap.docs.map(d => d.data() as AttendanceRecord);
    
    // Filter by hierarchy
    records = records.filter(r => r.branchId === branchId);
    
    if (batchId === 'ALL') {
       return records.filter(r => !date || r.date === date);
    }
    return records.filter(r => r.batchId === batchId && (!date || r.date === date));
  }
  
  async getStudentAttendance(studentId: string): Promise<AttendanceRecord[]> {
    const q = query(collection(firestore, "attendance"), where("studentId", "==", studentId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as AttendanceRecord);
  }
  async saveAttendance(records: AttendanceRecord[]): Promise<void> {
    const batch = writeBatch(firestore);
    records.forEach(rec => batch.set(doc(firestore, "attendance", rec.id), rec));
    await batch.commit();
  }

  async seedDatabase(): Promise<void> {
    const batch = writeBatch(firestore);
    SEED_BRANCHES.forEach(b => batch.set(doc(firestore, "branches", b.id), b));
    SEED_BATCHES.forEach(b => batch.set(doc(firestore, "batches", b.id), b));
    SEED_SUBJECTS.forEach(s => batch.set(doc(firestore, "subjects", s.id), s));
    SEED_USERS.forEach(u => batch.set(doc(firestore, "users", u.uid), u));
    SEED_ASSIGNMENTS.forEach(a => batch.set(doc(firestore, "assignments", a.id), a));
    await batch.commit();
  }
}

// --- MOCK Implementation ---
class MockService implements IDataService {
  private simulateDelay = () => new Promise(resolve => setTimeout(resolve, 300));
  private load(key: string, seed: any[]): any[] {
    const data = localStorage.getItem(key);
    if (!data) { localStorage.setItem(key, JSON.stringify(seed)); return seed; }
    return JSON.parse(data);
  }
  private save(key: string, data: any[]) { localStorage.setItem(key, JSON.stringify(data)); }
  constructor() { 
      if (!localStorage.getItem('ams_branches')) this.seedDatabase(); 
  }

  async login(email: string, pass: string): Promise<User> {
    await this.simulateDelay();
    const users = this.load('ams_users', SEED_USERS) as User[];
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (user && (!(user as any).password || (user as any).password === pass)) {
      localStorage.setItem('ams_current_user', JSON.stringify(user));
      return user;
    }
    throw new Error("Invalid credentials");
  }
  async logout() { localStorage.removeItem('ams_current_user'); }
  async getCurrentUser() { const d = localStorage.getItem('ams_current_user'); return d ? JSON.parse(d) : null; }
  async changePassword(c: string, n: string) { /* ... */ }

  async getBranches() { return this.load('ams_branches', SEED_BRANCHES); }
  async addBranch(name: string) { 
      const b = this.load('ams_branches', SEED_BRANCHES); 
      b.push({id:`b_${Date.now()}`, name}); 
      this.save('ams_branches', b); 
  }
  async deleteBranch(id: string) {
      const b = this.load('ams_branches', SEED_BRANCHES);
      this.save('ams_branches', b.filter((x:any)=>x.id!==id));
  }

  async getBatches(branchId: string) {
    await this.simulateDelay();
    const batches = this.load('ams_batches', SEED_BATCHES) as Batch[];
    return batches.filter(b => b.branchId === branchId);
  }
  async addBatch(name: string, branchId: string) {
    const batches = this.load('ams_batches', SEED_BATCHES);
    batches.push({id:`batch_${Date.now()}`, name, branchId});
    this.save('ams_batches', batches);
  }
  async deleteBatch(id: string) {
      const b = this.load('ams_batches', SEED_BATCHES);
      this.save('ams_batches', b.filter((x:any)=>x.id!==id));
  }

  async getStudents(branchId: string, batchId?: string) {
    const users = this.load('ams_users', SEED_USERS) as User[];
    let filtered = users.filter(u => u.role === UserRole.STUDENT && u.studentData?.branchId === branchId);
    if (batchId && batchId !== 'ALL') {
        filtered = filtered.filter(u => u.studentData?.batchId === batchId);
    }
    return filtered;
  }

  async createStudent(data: Partial<User>) {
    const users = this.load('ams_users', SEED_USERS) as User[];
    if (users.some(u => u.email === data.email || (data.studentData?.enrollmentId && u.studentData?.enrollmentId === data.studentData.enrollmentId))) {
      throw new Error(`Student with this email or Enrollment ID already exists.`);
    }
    users.push({...data, uid:`stu_${Date.now()}`, role: UserRole.STUDENT} as User);
    this.save('ams_users', users);
  }

  async importStudents(students: Partial<User>[]) {
    const users = this.load('ams_users', SEED_USERS) as User[];
    const existingEmails = new Set(users.map(u => u.email.toLowerCase()));
    const existingEnrollments = new Set(users.map(u => u.studentData?.enrollmentId?.toLowerCase()).filter(Boolean));
    let addedCount = 0;
    students.forEach((s, i) => {
      const email = s.email?.toLowerCase();
      const enroll = s.studentData?.enrollmentId?.toLowerCase();
      if (email && !existingEmails.has(email) && (!enroll || !existingEnrollments.has(enroll))) {
           users.push({...s, uid:`stu_${Date.now()}_${i}`, role: UserRole.STUDENT} as User);
           existingEmails.add(email);
           if (enroll) existingEnrollments.add(enroll);
           addedCount++;
      }
    });
    this.save('ams_users', users);
    if (addedCount === 0 && students.length > 0) throw new Error("All students were duplicates and skipped.");
  }

  async deleteUser(uid: string) {
      const u = this.load('ams_users', SEED_USERS);
      this.save('ams_users', u.filter((x:any)=>x.uid!==uid));
  }

  async getSubjects() { return this.load('ams_subjects', SEED_SUBJECTS); }
  async addSubject(name: string, code: string) {
      const s = this.load('ams_subjects', SEED_SUBJECTS);
      s.push({id:`sub_${Date.now()}`, name, code});
      this.save('ams_subjects', s);
  }
  async updateSubject(id: string, name: string, code: string) { 
      const s = this.load('ams_subjects', SEED_SUBJECTS);
      const idx = s.findIndex((x:any)=>x.id===id);
      if(idx>=0) { s[idx] = {...s[idx], name, code}; this.save('ams_subjects', s); }
  }
  async deleteSubject(id: string) { 
      const s = this.load('ams_subjects', SEED_SUBJECTS);
      this.save('ams_subjects', s.filter((x:any)=>x.id!==id));
  }

  async getFaculty() { return (this.load('ams_users', SEED_USERS) as User[]).filter(u => u.role === UserRole.FACULTY); }
  async createFaculty(data: Partial<User>, password?: string) { 
     const users = this.load('ams_users', SEED_USERS);
     users.push({...data, uid:`fac_${Date.now()}`, role: UserRole.FACULTY, password: password || 'password123'});
     this.save('ams_users', users);
  }
  async resetFacultyPassword(uid: string, newPass: string) { 
     const users = this.load('ams_users', SEED_USERS);
     const u = users.find((x:any)=>x.uid===uid);
     if(u) { (u as any).password = newPass; this.save('ams_users', users); }
  }

  async getAssignments(facultyId?: string) {
    const all = this.load('ams_assignments', SEED_ASSIGNMENTS) as FacultyAssignment[];
    if (facultyId) return all.filter(a => a.facultyId === facultyId);
    return all;
  }
  async assignFaculty(data: any) {
    const all = this.load('ams_assignments', SEED_ASSIGNMENTS);
    all.push({...data, id:`assign_${Date.now()}`});
    this.save('ams_assignments', all);
  }
  async removeAssignment(id: string) { 
      const all = this.load('ams_assignments', SEED_ASSIGNMENTS);
      this.save('ams_assignments', all.filter((x:any)=>x.id!==id));
  }

  async getAttendance(branchId: string, batchId: string, subjectId: string, date?: string) {
    const all = this.load('ams_attendance', []) as AttendanceRecord[];
    // Filter by branch and subject
    let filtered = all.filter(a => a.branchId === branchId && a.subjectId === subjectId);
    
    if (batchId === 'ALL') {
        return filtered.filter(a => !date || a.date === date);
    }
    return filtered.filter(a => a.batchId === batchId && (!date || a.date === date));
  }
  async getStudentAttendance(studentId: string) {
    const all = this.load('ams_attendance', []) as AttendanceRecord[];
    return all.filter(a => a.studentId === studentId);
  }
  async saveAttendance(records: AttendanceRecord[]) {
    const all = this.load('ams_attendance', []) as AttendanceRecord[];
    if (records.length > 0) {
      const recordMap = new Map<string, AttendanceRecord>();
      all.forEach(r => recordMap.set(r.id, r));
      records.forEach(r => recordMap.set(r.id, r));
      this.save('ams_attendance', Array.from(recordMap.values()));
    }
  }
  async seedDatabase() { 
      localStorage.setItem('ams_branches', JSON.stringify(SEED_BRANCHES));
      localStorage.setItem('ams_batches', JSON.stringify(SEED_BATCHES));
      localStorage.setItem('ams_subjects', JSON.stringify(SEED_SUBJECTS));
      localStorage.setItem('ams_users', JSON.stringify(SEED_USERS));
      localStorage.setItem('ams_assignments', JSON.stringify(SEED_ASSIGNMENTS));
      alert("Local Database seeded!");
  }
}

const hasFirebaseKey = firebaseConfig.apiKey && firebaseConfig.apiKey.length > 0 && !firebaseConfig.apiKey.includes('mock');
export const db = hasFirebaseKey ? new FirebaseService() : new MockService();
