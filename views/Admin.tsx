
import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Branch, ClassEntity, Batch, User, Subject, FacultyAssignment, AttendanceRecord } from '../types';
import { Card, Button, Input, Select, Modal, FileUploader } from '../components/UI';
import { Plus, Trash2, ChevronRight, Users, BookOpen, AlertCircle, Database, Edit, Eye, Info, Key, ArrowLeft, CheckCircle2, XCircle, GraduationCap, RefreshCw } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'students' | 'faculty'>('students');
  const [seeding, setSeeding] = useState(false);
  const [migrating, setMigrating] = useState(false);

  const handleSeed = async () => {
    if (!window.confirm("This will reset/overwrite initial data. Continue?")) return;
    setSeeding(true);
    try {
      await db.seedDatabase();
      alert("Database initialized successfully!");
    } catch(e: any) {
      console.error(e);
      if (e.code === 'permission-denied') {
        alert("Permission Denied! \n\nIt looks like your Firestore Rules are blocking the write operation.\n\nFix:\n1. Go to Firebase Console > Firestore > Rules\n2. Add this line: match /classes/{document=**} { allow read: if isAuthenticated(); allow write: if isAdmin(); }\n3. Ensure all collections (users, branches, etc) have write access for admins.");
      } else {
        alert("Seeding failed: " + e.message);
      }
    } finally {
      setSeeding(false);
    }
  };
  
  const handleMigrate = async () => {
    if(!window.confirm("This will move legacy data (Batches, Students, Assignments) into a default 'Year 1' class for their respective branches. Continue?")) return;
    setMigrating(true);
    try {
        await db.migrateToClassStructure();
        alert("Migration Successful! Legacy data has been moved to 'Year 1 (Migrated)' class.");
    } catch (e: any) {
        alert("Migration failed: " + e.message);
    } finally {
        setMigrating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-slate-300 pb-1">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('students')}
            className={`px-4 py-2 font-medium text-sm transition-colors ${activeTab === 'students' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Manage Students
          </button>
          <button
            onClick={() => setActiveTab('faculty')}
            className={`px-4 py-2 font-medium text-sm transition-colors ${activeTab === 'faculty' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Manage Faculty & Subjects
          </button>
        </div>
        
        <div className="flex gap-2">
            <button 
              onClick={handleSeed} 
              disabled={seeding} 
              className="mb-2 text-xs flex items-center px-3 py-1.5 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded transition-colors" 
              title="Reset/Populate Database with initial data"
            >
              <Database className="h-3 w-3 mr-1.5" />
              {seeding ? 'Seeding...' : 'Initialize Database'}
            </button>
        </div>
      </div>

      {activeTab === 'students' ? <StudentManagement /> : <FacultyManagement />}
    </div>
  );
};

const AdminStudentDetail: React.FC<{ student: User; onBack: () => void }> = ({ student, onBack }) => {
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [att, subs] = await Promise.all([
          db.getStudentAttendance(student.uid),
          db.getSubjects()
        ]);
        setAttendance(att);
        setSubjects(subs);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [student.uid]);

  const getSubjectStats = (subjectId: string) => {
    const relevant = attendance.filter(a => a.subjectId === subjectId);
    const total = relevant.length;
    const present = relevant.filter(a => a.isPresent).length;
    const percentage = total === 0 ? 0 : Math.round((present / total) * 100);
    return { total, present, percentage };
  };

  const subjectStats = subjects.map(s => {
    const stats = getSubjectStats(s.id);
    return { ...s, ...stats };
  }).filter(s => s.total > 0); 

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h3 className="text-xl font-bold text-slate-900">{student.displayName}</h3>
            <p className="text-sm text-slate-500 font-mono">
              {student.studentData?.enrollmentId} {student.studentData?.rollNo ? `| Roll: ${student.studentData.rollNo}` : ''}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading attendance records...</div>
      ) : (
        <div className="space-y-8">
          <div>
            <h4 className="text-sm font-bold text-slate-700 uppercase mb-3">Attendance Overview</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjectStats.map(stat => (
                <div key={stat.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-slate-800">{stat.name}</span>
                    <span className={`text-sm font-bold px-2 py-0.5 rounded ${stat.percentage < 75 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {stat.percentage}%
                    </span>
                  </div>
                  <div className="text-sm text-slate-500 flex justify-between">
                    <span>Attended: {stat.present} / {stat.total}</span>
                    <span className="font-mono text-xs">{stat.code}</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full mt-3 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${stat.percentage < 75 ? 'bg-red-500' : 'bg-indigo-500'}`} 
                      style={{ width: `${stat.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
              {subjectStats.length === 0 && (
                <div className="col-span-full p-4 text-slate-500 italic text-center bg-slate-50 rounded border border-dashed">
                  No attendance records found for this student.
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-slate-700 uppercase mb-3">Recent Activity Log</h4>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 font-semibold text-slate-600">Date</th>
                    <th className="px-4 py-2 font-semibold text-slate-600">Subject</th>
                    <th className="px-4 py-2 font-semibold text-slate-600 text-center">Slot</th>
                    <th className="px-4 py-2 font-semibold text-slate-600 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...attendance]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map(r => {
                      const subject = subjects.find(s => s.id === r.subjectId);
                      return (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-mono text-slate-600">{r.date}</td>
                          <td className="px-4 py-2 text-slate-900">
                            {subject?.name} <span className="text-xs text-slate-400">({subject?.code})</span>
                          </td>
                          <td className="px-4 py-2 text-center text-slate-500">L{r.lectureSlot || 1}</td>
                          <td className="px-4 py-2 text-right">
                            {r.isPresent ? (
                              <span className="inline-flex items-center text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs font-medium">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Present
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-red-700 bg-red-50 px-2 py-0.5 rounded text-xs font-medium">
                                <XCircle className="h-3 w-3 mr-1" /> Absent
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  {attendance.length === 0 && (
                     <tr><td colSpan={4} className="p-4 text-center text-slate-400">No logs available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

const StudentManagement: React.FC = () => {
  const [level, setLevel] = useState<'branches' | 'classes' | 'batches' | 'students'>('branches');
  
  const [branches, setBranches] = useState<Branch[]>([]);
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  
  const [selBranch, setSelBranch] = useState<Branch | null>(null);
  const [selClass, setSelClass] = useState<ClassEntity | null>(null);
  const [selBatch, setSelBatch] = useState<Batch | null>(null);

  const [viewStudent, setViewStudent] = useState<User | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadBranches(); }, []);

  const loadBranches = async () => {
    const data = await db.getBranches();
    setBranches(data);
  };

  const handleSelectBranch = async (b: Branch) => {
    setSelBranch(b);
    const cls = await db.getClasses(b.id);
    setClasses(cls);
    setLevel('classes');
  };

  const handleSelectClass = async (c: ClassEntity) => {
    setSelClass(c);
    const data = await db.getBatches(c.id);
    setBatches(data);
    setLevel('batches');
  };

  const handleSelectBatch = async (b: Batch) => {
    setSelBatch(b);
    if (selClass) {
      const studentData = await db.getStudents(selClass.id, b.id);
      setStudents(studentData);
    }
    setLevel('students');
  };

  const handleAdd = async () => {
    if (!newItemName) return;
    if (level === 'branches') {
      await db.addBranch(newItemName);
      loadBranches();
    } else if (level === 'classes' && selBranch) {
      await db.addClass(newItemName, selBranch.id);
      const cls = await db.getClasses(selBranch.id);
      setClasses(cls);
    } else if (level === 'batches' && selClass) {
      await db.addBatch(newItemName, selClass.id);
      const batchData = await db.getBatches(selClass.id);
      setBatches(batchData);
    }
    setNewItemName('');
  };

  const handleCSVUpload = async (file: File) => {
    if (!selBranch || !selClass || !selBatch) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      const newStudents: Partial<User>[] = [];
      const startIndex = lines[0].toLowerCase().includes('enrollment') ? 1 : 0;
      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(',').map(s => s.trim());
        let enroll, roll, name, email;
        if (parts.length >= 4) { [enroll, roll, name, email] = parts; }
        else if (parts.length === 3) { [enroll, name, email] = parts; roll = ''; }
        if (enroll && name && email) {
          newStudents.push({
            displayName: name, email: email,
            studentData: { branchId: selBranch.id, classId: selClass.id, batchId: selBatch.id, enrollmentId: enroll, rollNo: roll }
          });
        }
      }
      if (newStudents.length > 0) {
        try {
          await db.importStudents(newStudents);
          alert(`Imported ${newStudents.length} students.`);
          setStudents(await db.getStudents(selClass.id, selBatch.id));
        } catch (err: any) { alert("Import failed: " + err.message); }
      }
      setLoading(false);
    };
    reader.readAsText(file);
  };

  const [newStudent, setNewStudent] = useState({ name: '', email: '', enroll: '', rollNo: '' });
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selBranch || !selClass || !selBatch) return;
    setLoading(true);
    try {
      await db.createStudent({
        displayName: newStudent.name, email: newStudent.email,
        studentData: { branchId: selBranch.id, classId: selClass.id, batchId: selBatch.id, enrollmentId: newStudent.enroll, rollNo: newStudent.rollNo }
      });
      setNewStudent({ name: '', email: '', enroll: '', rollNo: '' });
      setStudents(await db.getStudents(selClass.id, selBatch.id));
      alert(`Student added.`);
    } catch (e: any) { alert("Error adding student: " + e.message); } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (level === 'branches') {
      if(!window.confirm("Delete Branch?")) return;
      await db.deleteBranch(id);
      loadBranches();
    } else if (level === 'classes' && selBranch) {
        if(!window.confirm("Delete Class?")) return;
        await db.deleteClass(id);
        setClasses(await db.getClasses(selBranch.id));
    } else if (level === 'batches' && selClass) {
      if(!window.confirm("Delete Batch?")) return;
      await db.deleteBatch(id);
      setBatches(await db.getBatches(selClass.id));
    } else if (level === 'students' && selClass && selBatch) {
      if(!window.confirm("Delete Student?")) return;
      await db.deleteUser(id);
      setStudents(await db.getStudents(selClass.id, selBatch.id));
    }
  };

  if (viewStudent) return <AdminStudentDetail student={viewStudent} onBack={() => setViewStudent(null)} />;

  let listItems: any[] = [];
  if (level === 'branches') listItems = branches;
  else if (level === 'classes') listItems = classes;
  else if (level === 'batches') listItems = batches;

  const handleItemClick = (item: any) => {
      if (level === 'branches') handleSelectBranch(item);
      else if (level === 'classes') handleSelectClass(item);
      else if (level === 'batches') handleSelectBatch(item);
  };

  return (
    <Card>
      <div className="flex items-center text-sm mb-6 text-slate-500 flex-wrap">
        <span className={`cursor-pointer hover:text-indigo-600 ${level === 'branches' ? 'font-bold text-indigo-600' : ''}`} onClick={() => { setLevel('branches'); setSelBranch(null); setSelClass(null); setSelBatch(null); }}>Branches</span>
        {selBranch && (
          <>
            <ChevronRight className="h-4 w-4 mx-2" />
            <span className={`cursor-pointer hover:text-indigo-600 ${level === 'classes' ? 'font-bold text-indigo-600' : ''}`} onClick={() => { setLevel('classes'); setSelClass(null); setSelBatch(null); }}>{selBranch.name}</span>
          </>
        )}
        {selClass && (
            <>
            <ChevronRight className="h-4 w-4 mx-2" />
            <span className={`cursor-pointer hover:text-indigo-600 ${level === 'batches' ? 'font-bold text-indigo-600' : ''}`} onClick={() => { setLevel('batches'); setSelBatch(null); }}>{selClass.name}</span>
          </>
        )}
        {selBatch && (
          <>
            <ChevronRight className="h-4 w-4 mx-2" />
            <span className="font-bold text-indigo-600">{selBatch.name}</span>
          </>
        )}
      </div>

      {level !== 'students' ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input 
              placeholder={`New ${level === 'branches' ? 'Branch' : level === 'classes' ? 'Class' : 'Batch'} Name`} 
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="flex-grow text-slate-900 bg-white"
            />
            <Button onClick={handleAdd}><Plus className="h-4 w-4 mr-1 inline" /> Add</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {listItems.map((item) => (
              <div 
                key={item.id} 
                onClick={() => handleItemClick(item)}
                className="group border border-slate-200 rounded-lg p-4 hover:border-indigo-400 hover:shadow-md cursor-pointer bg-slate-50 transition flex justify-between items-center"
              >
                <div className="flex items-center">
                  <div className="bg-white p-2 rounded-full border border-slate-200 mr-3">
                    {level === 'branches' ? <BookOpen className="h-5 w-5 text-indigo-500" /> : level === 'classes' ? <GraduationCap className="h-5 w-5 text-indigo-500" /> : <Users className="h-5 w-5 text-indigo-500" />}
                  </div>
                  <span className="font-semibold text-slate-800">{item.name}</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="text-slate-400 hover:text-red-600 p-2 transition opacity-0 group-hover:opacity-100">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
           <div className="flex flex-col gap-4 bg-slate-50 p-4 rounded-md border border-slate-200">
              <form onSubmit={handleAddStudent} className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
                 <Input label="Name" required value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} className="mb-0 text-slate-900 bg-white" />
                 <Input label="Email" type="email" required value={newStudent.email} onChange={e => setNewStudent({...newStudent, email: e.target.value})} className="mb-0 text-slate-900 bg-white" />
                 <Input label="Enrollment ID" required value={newStudent.enroll} onChange={e => setNewStudent({...newStudent, enroll: e.target.value})} className="mb-0 text-slate-900 bg-white" />
                 <Input label="Roll No" value={newStudent.rollNo} onChange={e => setNewStudent({...newStudent, rollNo: e.target.value})} className="mb-0 text-slate-900 bg-white" />
              </form>
              <div className="flex gap-2 w-full justify-end">
                <FileUploader onFileSelect={handleCSVUpload} label="Import CSV" />
                <Button onClick={handleAddStudent} disabled={loading} className="w-full md:w-auto">{loading ? 'Adding...' : 'Add Student'}</Button>
              </div>
           </div>
           
           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="border-b border-slate-300 text-slate-600 text-sm">
                   <th className="py-2 px-2">Enrollment</th>
                   <th className="py-2 px-2">Roll No</th>
                   <th className="py-2 px-2">Name</th>
                   <th className="py-2 px-2">Email</th>
                   <th className="py-2 px-2 text-right">Actions</th>
                 </tr>
               </thead>
               <tbody>
                 {students.map(s => (
                   <tr key={s.uid} className="border-b border-slate-100 hover:bg-slate-50 group">
                     <td className="py-3 px-2 font-mono text-sm text-slate-700">{s.studentData?.enrollmentId}</td>
                     <td className="py-3 px-2 font-mono text-sm text-slate-700">{s.studentData?.rollNo || '-'}</td>
                     <td className="py-3 px-2 font-medium text-slate-900">{s.displayName}</td>
                     <td className="py-3 px-2 text-slate-600">{s.email}</td>
                     <td className="py-3 px-2 text-right space-x-2">
                        <button onClick={() => setViewStudent(s)} className="text-indigo-500 hover:text-indigo-700 opacity-0 group-hover:opacity-100 transition" title="View"><Eye className="h-4 w-4"/></button>
                        <button onClick={() => handleDelete(s.uid)} className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition" title="Delete"><Trash2 className="h-4 w-4"/></button>
                     </td>
                   </tr>
                 ))}
                 {students.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-slate-500">No students.</td></tr>}
               </tbody>
             </table>
           </div>
        </div>
      )}
    </Card>
  );
};

const FacultyManagement: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'subjects' | 'faculty_list' | 'allocations'>('subjects');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [faculty, setFaculty] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<FacultyAssignment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  // Metadata maps for table display
  const [classMap, setClassMap] = useState<Record<string, string>>({});
  const [batchMap, setBatchMap] = useState<Record<string, string>>({});

  const [newSub, setNewSub] = useState({ name: '', code: '' });
  const [newFac, setNewFac] = useState({ name: '', email: '', password: '' });
  const [assignForm, setAssignForm] = useState({ facultyId: '', subjectId: '', branchId: '', classId: '', batchId: '' });

  const [editSubject, setEditSubject] = useState<Subject | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState<{ facultyId: string; subjectId: string; branchId: string; classId: string; batchId: string } | null>(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [selectedFacultyForReset, setSelectedFacultyForReset] = useState<User | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoadingData(true);
    try {
      const subs = await db.getSubjects();
      const facs = await db.getFaculty();
      const assigns = await db.getAssignments();
      const brs = await db.getBranches();
      
      setSubjects(subs);
      setFaculty(facs);
      setAssignments(assigns);
      setBranches(brs);

      // Resolve metadata for table display
      const cMap: Record<string, string> = {};
      const bMap: Record<string, string> = {};
      
      const classIds = Array.from(new Set(assigns.map(a => a.classId).filter(Boolean)));
      const branchIds = Array.from(new Set(assigns.map(a => a.branchId).filter(Boolean)));
      
      // Fetch classes involved in assignments
      for (const bid of branchIds) {
          const cls = await db.getClasses(bid);
          cls.forEach(c => cMap[c.id] = c.name);
      }
      // Fetch batches involved in assignments
      for (const cid of classIds) {
          const bts = await db.getBatches(cid);
          bts.forEach(b => bMap[b.id] = b.name);
      }
      
      setClassMap(cMap);
      setBatchMap(bMap);

    } finally { setIsLoadingData(false); }
  };

  const loadClasses = async (branchId: string) => {
    const data = await db.getClasses(branchId);
    setClasses(data);
  };

  const loadBatches = async (classId: string) => {
    const data = await db.getBatches(classId);
    setBatches(data);
  };
  
  const handleAddSubject = async () => { if(newSub.name && newSub.code) { await db.addSubject(newSub.name, newSub.code); setNewSub({name:'', code:''}); setSubjects(await db.getSubjects()); } };
  const handleUpdateSubject = async () => { if (editSubject) { await db.updateSubject(editSubject.id, editSubject.name, editSubject.code); setEditSubject(null); setSubjects(await db.getSubjects()); } };
  const handleAddFaculty = async (e: React.FormEvent) => { e.preventDefault(); if (newFac.name) { setActionLoading(true); try { await db.createFaculty({ displayName: newFac.name, email: newFac.email }, newFac.password); setNewFac({ name: '', email: '', password: '' }); setFaculty(await db.getFaculty()); alert("Faculty added."); } catch(e:any) { alert(e.message); } finally { setActionLoading(false); } } };
  const handleDeleteFaculty = async (uid: string) => { if(!window.confirm("Delete?")) return; await db.deleteUser(uid); setFaculty(await db.getFaculty()); };
  const handleDeleteSubject = async (id: string) => { if(!window.confirm("Delete?")) return; await db.deleteSubject(id); setSubjects(await db.getSubjects()); };
  const handleDeleteAssignment = async (id: string) => { if(!window.confirm("Remove?")) return; await db.removeAssignment(id); loadData(); };
  const initiateResetPassword = (f: User) => { setSelectedFacultyForReset(f); setResetModalOpen(true); };
  const handleResetPassword = async () => { if (selectedFacultyForReset && newPasswordInput) { setActionLoading(true); try { await db.resetFacultyPassword(selectedFacultyForReset.uid, newPasswordInput); alert("Password updated"); setResetModalOpen(false); setFaculty(await db.getFaculty()); } catch(e:any) { alert(e.message); } finally { setActionLoading(false); } } };

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.values(assignForm).every(v => v)) {
      setPendingAssignment(assignForm);
      setConfirmModalOpen(true);
    }
  };

  const confirmAssignment = async () => {
    if (pendingAssignment) {
      await db.assignFaculty(pendingAssignment);
      // Reload everything to update map and list
      await loadData();
      setAssignForm({ ...assignForm, subjectId: '' }); 
      setPendingAssignment(null);
      setConfirmModalOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-200 p-1 rounded-lg inline-flex">
         <button onClick={() => setActiveSubTab('subjects')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeSubTab === 'subjects' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}>Subject Library</button>
         <button onClick={() => setActiveSubTab('faculty_list')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeSubTab === 'faculty_list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}>Faculty Directory</button>
         <button onClick={() => setActiveSubTab('allocations')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeSubTab === 'allocations' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}>Allocations</button>
      </div>
      
      {isLoadingData ? <div className="p-8 text-center">Loading...</div> : (
        <>
          {activeSubTab === 'subjects' && (
             <Card>
                <h3 className="font-bold mb-4">Subjects</h3>
                <div className="flex gap-2 mb-4 bg-slate-50 p-4 rounded">
                   <input placeholder="Name" className="border p-2 rounded w-full text-slate-900 bg-white" value={newSub.name} onChange={e=>setNewSub({...newSub, name:e.target.value})} />
                   <input placeholder="Code" className="border p-2 rounded w-32 text-slate-900 bg-white" value={newSub.code} onChange={e=>setNewSub({...newSub, code:e.target.value})} />
                   <Button onClick={handleAddSubject}>Add</Button>
                </div>
                <table className="w-full text-left text-sm">
                   <thead className="bg-slate-50 border-b"><tr><th className="p-2">Code</th><th className="p-2">Name</th><th className="p-2 text-right">Action</th></tr></thead>
                   <tbody>{subjects.map(s => <tr key={s.id} className="border-b"><td className="p-2">{s.code}</td><td className="p-2">{s.name}</td><td className="p-2 text-right"><button onClick={()=>handleDeleteSubject(s.id)}><Trash2 className="h-4 w-4"/></button></td></tr>)}</tbody>
                </table>
             </Card>
          )}

          {activeSubTab === 'faculty_list' && (
             <Card>
               <h3 className="font-bold mb-4">Faculty</h3>
               <form onSubmit={handleAddFaculty} className="mb-4 grid grid-cols-4 gap-2 bg-slate-50 p-4 rounded">
                  <Input label="Name" value={newFac.name} onChange={e=>setNewFac({...newFac, name:e.target.value})} required className="mb-0 text-slate-900 bg-white"/>
                  <Input label="Email" value={newFac.email} onChange={e=>setNewFac({...newFac, email:e.target.value})} required className="mb-0 text-slate-900 bg-white"/>
                  <Input label="Password" type="password" value={newFac.password} onChange={e=>setNewFac({...newFac, password:e.target.value})} required className="mb-0 text-slate-900 bg-white"/>
                  <div className="flex items-end"><Button type="submit" disabled={actionLoading}>Add</Button></div>
               </form>
               <table className="w-full text-left text-sm">
                   <thead className="bg-slate-50 border-b"><tr><th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2 text-right">Actions</th></tr></thead>
                   <tbody>{faculty.map(f => <tr key={f.uid} className="border-b"><td className="p-2">{f.displayName}</td><td className="p-2">{f.email}</td><td className="p-2 text-right flex justify-end gap-2"><button onClick={()=>initiateResetPassword(f)}><Key className="h-4 w-4"/></button><button onClick={()=>handleDeleteFaculty(f.uid)}><Trash2 className="h-4 w-4"/></button></td></tr>)}</tbody>
               </table>
             </Card>
          )}

          {activeSubTab === 'allocations' && (
            <Card>
              <h3 className="text-lg font-bold mb-4">Course Allocations</h3>
              <div className="bg-indigo-50 p-5 rounded-lg border border-indigo-100 mb-8">
                <form onSubmit={handleAssign} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                  <div className="md:col-span-1">
                    <label className="block text-xs font-semibold text-indigo-700 mb-1">Faculty</label>
                    <Select className="mb-0" value={assignForm.facultyId} onChange={e => setAssignForm({...assignForm, facultyId: e.target.value})} required>
                      <option value="">Select Faculty</option>
                      {faculty.map(f => <option key={f.uid} value={f.uid}>{f.displayName}</option>)}
                    </Select>
                  </div>
                  
                  <div className="md:col-span-1">
                    <label className="block text-xs font-semibold text-indigo-700 mb-1">Branch</label>
                    <Select className="mb-0" value={assignForm.branchId} onChange={e => {
                        setAssignForm({...assignForm, branchId: e.target.value, classId: '', batchId: ''});
                        loadClasses(e.target.value);
                    }} required>
                        <option value="">Branch</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </Select>
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-xs font-semibold text-indigo-700 mb-1">Class</label>
                    <Select className="mb-0" value={assignForm.classId} onChange={e => {
                        setAssignForm({...assignForm, classId: e.target.value, batchId: ''});
                        loadBatches(e.target.value);
                    }} required disabled={!assignForm.branchId}>
                        <option value="">Class</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-xs font-semibold text-indigo-700 mb-1">Batch</label>
                    <Select className="mb-0" value={assignForm.batchId} onChange={e => setAssignForm({...assignForm, batchId: e.target.value})} required disabled={!assignForm.classId}>
                        <option value="">Batch</option>
                        <option value="ALL">All Batches</option>
                        {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </Select>
                  </div>

                  <div className="md:col-span-1">
                     <label className="block text-xs font-semibold text-indigo-700 mb-1">Subject</label>
                    <Select className="mb-0" value={assignForm.subjectId} onChange={e => setAssignForm({...assignForm, subjectId: e.target.value})} required>
                      <option value="">Select Subject</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                    </Select>
                  </div>

                   <div className="md:col-span-5 flex justify-end">
                    <Button type="submit">Assign Class</Button>
                  </div>
                </form>
              </div>

               <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b"><tr><th className="px-4 py-3">Faculty</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Class Context</th><th className="px-4 py-3 text-right">Remove</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {assignments.map(a => {
                      const fac = faculty.find(f => f.uid === a.facultyId);
                      const sub = subjects.find(s => s.id === a.subjectId);
                      // Resolve Names
                      const branchName = branches.find(b => b.id === a.branchId)?.name || a.branchId || 'Unknown Branch';
                      const className = classMap[a.classId] || a.classId?.replace('cl_', '').replace(/_/g, ' ') || '?';
                      const batchName = a.batchId === 'ALL' ? 'All Batches' : (batchMap[a.batchId] || a.batchId?.replace('batch_', '').replace(/_/g, ' ') || '?');

                      return (
                        <tr key={a.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">{fac?.displayName}</td>
                          <td className="px-4 py-3">{sub?.name}</td>
                          <td className="px-4 py-3 text-slate-600">
                            <div className="flex flex-col text-xs">
                                <span className="font-semibold text-slate-700">{branchName}</span>
                                <span className="text-slate-500">
                                    {className} <span className="mx-1 text-slate-300">|</span> {batchName}
                                </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right"><button onClick={() => handleDeleteAssignment(a.id)}><Trash2 className="h-4 w-4 text-slate-400 hover:text-red-500"/></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
      
      <Modal isOpen={confirmModalOpen} onClose={() => setConfirmModalOpen(false)} title="Confirm">
          <div className="p-4">
              <p>Assign <b>{subjects.find(s=>s.id===pendingAssignment?.subjectId)?.name}</b> to <b>{faculty.find(f=>f.uid===pendingAssignment?.facultyId)?.displayName}</b>?</p>
              <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={()=>setConfirmModalOpen(false)}>Cancel</Button><Button onClick={confirmAssignment}>Confirm</Button></div>
          </div>
      </Modal>
      <Modal isOpen={resetModalOpen} onClose={() => setResetModalOpen(false)} title="Reset Password">
        <div className="space-y-4">
          <Input label="New Password" type="password" value={newPasswordInput} onChange={e => setNewPasswordInput(e.target.value)} />
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setResetModalOpen(false)}>Cancel</Button><Button onClick={handleResetPassword} disabled={actionLoading}>Update</Button></div>
        </div>
      </Modal>
    </div>
  );
};
