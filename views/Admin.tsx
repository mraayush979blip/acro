
import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Branch, Batch, User, Subject, FacultyAssignment, AttendanceRecord } from '../types';
import { Card, Button, Input, Select, Modal, FileUploader } from '../components/UI';
import { Plus, Trash2, ChevronRight, Users, BookOpen, Database, Key, ArrowLeft, CheckCircle2, XCircle, Trash, Eye, Layers, Edit2 } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'students' | 'faculty'>('students');
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    if (!window.confirm("This will reset/overwrite initial data. Continue?")) return;
    setSeeding(true);
    try {
      await db.seedDatabase();
      alert("Database initialized successfully!");
    } catch(e: any) {
      if (e.code === 'permission-denied') {
        alert("Permission Denied! Check Firestore Rules.");
      } else {
        alert("Seeding failed: " + e.message);
      }
    } finally {
      setSeeding(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-slate-300 pb-1">
        <div className="flex space-x-2">
          <button onClick={() => setActiveTab('students')} className={`px-4 py-2 font-medium text-sm transition-colors ${activeTab === 'students' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}>Manage Students</button>
          <button onClick={() => setActiveTab('faculty')} className={`px-4 py-2 font-medium text-sm transition-colors ${activeTab === 'faculty' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}>Manage Faculty & Subjects</button>
        </div>
        <button onClick={handleSeed} disabled={seeding} className="mb-2 text-xs flex items-center px-3 py-1.5 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded transition-colors"><Database className="h-3 w-3 mr-1.5" />{seeding ? 'Seeding...' : 'Initialize Database'}</button>
      </div>
      {activeTab === 'students' ? <StudentManagement /> : <FacultyManagement />}
    </div>
  );
};

// ... AdminStudentDetail component remains same ...
const AdminStudentDetail: React.FC<{ student: User; onBack: () => void }> = ({ student, onBack }) => {
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [att, subs] = await Promise.all([db.getStudentAttendance(student.uid), db.getSubjects()]);
        setAttendance(att);
        setSubjects(subs);
      } finally { setLoading(false); }
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
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition"><ArrowLeft className="h-5 w-5" /></button>
          <div>
            <h3 className="text-xl font-bold text-slate-900">{student.displayName}</h3>
            <p className="text-sm text-slate-500 font-mono">{student.studentData?.enrollmentId} {student.studentData?.rollNo ? `| Roll: ${student.studentData.rollNo}` : ''}</p>
          </div>
        </div>
      </div>
      {loading ? <div className="p-12 text-center text-slate-500">Loading records...</div> : (
        <div className="space-y-8">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjectStats.map(stat => (
                <div key={stat.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2"><span className="font-semibold text-slate-800">{stat.name}</span><span className={`text-sm font-bold px-2 py-0.5 rounded ${stat.percentage < 75 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{stat.percentage}%</span></div>
                  <div className="text-sm text-slate-500 flex justify-between"><span>Attended: {stat.present} / {stat.total}</span></div>
                </div>
              ))}
              {subjectStats.length === 0 && <div className="col-span-full p-4 text-center bg-slate-50 border border-dashed rounded text-slate-500">No attendance data.</div>}
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
               <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b"><tr><th className="px-4 py-2 text-slate-900">Date</th><th className="px-4 py-2 text-slate-900">Subject</th><th className="px-4 py-2 text-center text-slate-900">Slot</th><th className="px-4 py-2 text-right text-slate-900">Status</th></tr></thead>
                  <tbody>
                     {attendance.sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).map(r => (
                        <tr key={r.id} className="hover:bg-slate-50"><td className="px-4 py-2 text-slate-900 font-mono">{r.date}</td><td className="px-4 py-2 text-slate-900">{subjects.find(s=>s.id===r.subjectId)?.name}</td><td className="px-4 py-2 text-center text-slate-900">L{r.lectureSlot||1}</td><td className="px-4 py-2 text-right">{r.isPresent?<span className="text-green-600 font-bold">Present</span>:<span className="text-red-600 font-bold">Absent</span>}</td></tr>
                     ))}
                  </tbody>
               </table>
            </div>
        </div>
      )}
    </Card>
  );
}

const StudentManagement: React.FC = () => {
  const [level, setLevel] = useState<'branches' | 'batches' | 'students'>('branches');
  
  const [branches, setBranches] = useState<Branch[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  
  const [selBranch, setSelBranch] = useState<Branch | null>(null);
  const [selBatch, setSelBatch] = useState<Batch | null>(null);

  const [viewStudent, setViewStudent] = useState<User | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadBranches(); }, []);
  const loadBranches = async () => { setBranches(await db.getBranches()); };
  
  const handleSelectBranch = async (b: Branch) => { setSelBranch(b); setBatches(await db.getBatches(b.id)); setLevel('batches'); };
  const handleSelectBatch = async (b: Batch) => { 
      setSelBatch(b); 
      if (selBranch) setStudents(await db.getStudents(selBranch.id, b.id)); 
      setLevel('students'); 
  };

  const handleAdd = async () => {
    if (!newItemName) return;
    if (level === 'branches') { await db.addBranch(newItemName); loadBranches(); }
    else if (level === 'batches' && selBranch) { await db.addBatch(newItemName, selBranch.id); setBatches(await db.getBatches(selBranch.id)); }
    setNewItemName('');
  };

  const handleCSVUpload = async (file: File) => {
    if (!selBranch || !selBatch) return;
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
            studentData: { branchId: selBranch.id, batchId: selBatch.id, enrollmentId: enroll, rollNo: roll }
          });
        }
      }
      if (newStudents.length > 0) {
        try { await db.importStudents(newStudents); alert(`Imported ${newStudents.length} students.`); setStudents(await db.getStudents(selBranch.id, selBatch.id)); } catch (err: any) { alert("Import failed: " + err.message); }
      }
      setLoading(false);
    };
    reader.readAsText(file);
  };

  const [newStudent, setNewStudent] = useState({ name: '', email: '', enroll: '', rollNo: '' });
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selBranch || !selBatch) return;
    setLoading(true);
    try {
      await db.createStudent({ displayName: newStudent.name, email: newStudent.email, studentData: { branchId: selBranch.id, batchId: selBatch.id, enrollmentId: newStudent.enroll, rollNo: newStudent.rollNo } });
      setNewStudent({ name: '', email: '', enroll: '', rollNo: '' });
      setStudents(await db.getStudents(selBranch.id, selBatch.id));
      alert(`Student added.`);
    } catch (e: any) { alert(e.message); } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if(!window.confirm("Delete?")) return;
    if (level === 'branches') { await db.deleteBranch(id); loadBranches(); }
    else if (level === 'batches' && selBranch) { await db.deleteBatch(id); setBatches(await db.getBatches(selBranch.id)); }
    else if (level === 'students' && selBranch && selBatch) { await db.deleteUser(id); setStudents(await db.getStudents(selBranch.id, selBatch.id)); }
  };

  if (viewStudent) return <AdminStudentDetail student={viewStudent} onBack={() => setViewStudent(null)} />;

  let listItems: any[] = [];
  if (level === 'branches') listItems = branches;
  else if (level === 'batches') listItems = batches;

  return (
    <Card>
      <div className="flex items-center text-sm mb-6 text-slate-500 flex-wrap">
        <span className={`cursor-pointer hover:text-indigo-600 ${level === 'branches' ? 'font-bold text-indigo-600' : ''}`} onClick={() => { setLevel('branches'); setSelBranch(null); }}>Branches</span>
        {selBranch && <><ChevronRight className="h-4 w-4 mx-2" /><span className={`cursor-pointer hover:text-indigo-600 ${level === 'batches' ? 'font-bold text-indigo-600' : ''}`} onClick={() => { setLevel('batches'); setSelBatch(null); }}>{selBranch.name}</span></>}
        {selBatch && <><ChevronRight className="h-4 w-4 mx-2" /><span className="font-bold text-indigo-600">{selBatch.name}</span></>}
      </div>

      {level !== 'students' ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder={`New ${level === 'branches' ? 'Branch' : 'Batch'} Name`} value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="flex-grow text-slate-900 bg-white" />
            <Button onClick={handleAdd}><Plus className="h-4 w-4 mr-1 inline" /> Add</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {listItems.map((item) => (
              <div key={item.id} onClick={() => { if(level==='branches') handleSelectBranch(item); else handleSelectBatch(item); }} className="group border p-4 rounded-lg cursor-pointer bg-slate-50 hover:border-indigo-400 hover:shadow-md flex justify-between items-center">
                 <div className="flex items-center"><span className="font-semibold text-slate-800">{item.name}</span></div>
                 <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="text-slate-400 hover:text-red-600 p-2 opacity-0 group-hover:opacity-100"><Trash2 className="h-4 w-4"/></button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
           <div className="bg-slate-50 p-4 rounded border">
              <form onSubmit={handleAddStudent} className="grid grid-cols-4 gap-4 mb-2">
                 <Input label="Name" required value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} className="mb-0 text-slate-900 bg-white"/>
                 <Input label="Email" required value={newStudent.email} onChange={e => setNewStudent({...newStudent, email: e.target.value})} className="mb-0 text-slate-900 bg-white"/>
                 <Input label="Enrollment" required value={newStudent.enroll} onChange={e => setNewStudent({...newStudent, enroll: e.target.value})} className="mb-0 text-slate-900 bg-white"/>
                 <Input label="Roll No" value={newStudent.rollNo} onChange={e => setNewStudent({...newStudent, rollNo: e.target.value})} className="mb-0 text-slate-900 bg-white"/>
              </form>
              <div className="flex justify-end gap-2"><FileUploader onFileSelect={handleCSVUpload} label="Import CSV" /><Button onClick={handleAddStudent} disabled={loading}>{loading?'Adding...':'Add Student'}</Button></div>
           </div>
           <table className="w-full text-left text-sm">
               <thead className="bg-slate-50 border-b"><tr><th className="p-2 text-slate-900">Enrollment</th><th className="p-2 text-slate-900">Roll No</th><th className="p-2 text-slate-900">Name</th><th className="p-2 text-slate-900">Email</th><th className="p-2 text-right text-slate-900">Actions</th></tr></thead>
               <tbody>{students.map(s=>(<tr key={s.uid} className="border-b group"><td className="p-2 font-mono text-slate-900">{s.studentData?.enrollmentId}</td><td className="p-2 font-mono text-slate-900">{s.studentData?.rollNo}</td><td className="p-2 text-slate-900">{s.displayName}</td><td className="p-2 text-slate-900">{s.email}</td><td className="p-2 text-right"><button onClick={()=>setViewStudent(s)} className="text-indigo-500 mr-2 opacity-0 group-hover:opacity-100"><Eye className="h-4 w-4"/></button><button onClick={()=>handleDelete(s.uid)} className="text-red-500 opacity-0 group-hover:opacity-100"><Trash2 className="h-4 w-4"/></button></td></tr>))}</tbody>
           </table>
        </div>
      )}
    </Card>
  );
};

const FacultyManagement: React.FC = () => {
  // ... (Subtab state and basic data loaders same as before)
  const [activeSubTab, setActiveSubTab] = useState<'subjects' | 'faculty_list' | 'allocations'>('subjects');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [faculty, setFaculty] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<FacultyAssignment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  const [newSub, setNewSub] = useState({ name: '', code: '' });
  const [newFac, setNewFac] = useState({ name: '', email: '', password: '' });
  
  // Assignment Form State
  const [assignForm, setAssignForm] = useState({ facultyId: '', subjectId: '', branchId: '', batchId: '' });
  const [isEditingAssignment, setIsEditingAssignment] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState<any>(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [selectedFacultyForReset, setSelectedFacultyForReset] = useState<User | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [isLoadingData, setIsLoadingData] = useState(false);
  
  // Maps for displaying names in table
  const [classMap, setClassMap] = useState<Record<string, string>>({}); // Actually class context names
  const [batchMap, setBatchMap] = useState<Record<string, string>>({});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoadingData(true);
    setSubjects(await db.getSubjects());
    setFaculty(await db.getFaculty());
    setAssignments(await db.getAssignments());
    setBranches(await db.getBranches());
    
    // Pre-fetch all batches for context
    const allAssignments = await db.getAssignments();
    const involvedBranchIds = Array.from(new Set(allAssignments.map(a => a.branchId)));
    const bMap: Record<string, string> = {};
    for (const bid of involvedBranchIds) {
        const bts = await db.getBatches(bid);
        bts.forEach(b => bMap[b.id] = b.name);
    }
    setBatchMap(bMap);
    
    setIsLoadingData(false);
  };

  const loadBatches = async (branchId: string) => { setBatches(await db.getBatches(branchId)); };

  const handleAddSubject = async () => { if(newSub.name) { await db.addSubject(newSub.name, newSub.code); setNewSub({name:'',code:''}); setSubjects(await db.getSubjects()); }};
  const handleDeleteSubject = async (id: string) => { if(confirm("Delete?")) { await db.deleteSubject(id); setSubjects(await db.getSubjects()); }};
  const handleAddFaculty = async (e: React.FormEvent) => { e.preventDefault(); try { await db.createFaculty({displayName:newFac.name, email:newFac.email}, newFac.password); setNewFac({name:'',email:'',password:''}); setFaculty(await db.getFaculty()); alert("Faculty added."); } catch(e:any){alert(e.message);} };
  const handleDeleteFaculty = async (uid: string) => { if(confirm("Delete?")) { await db.deleteUser(uid); setFaculty(await db.getFaculty()); }};
  const initiateResetPassword = (f: User) => { setSelectedFacultyForReset(f); setResetModalOpen(true); };
  const handleResetPassword = async () => { if(selectedFacultyForReset) { try { await db.resetFacultyPassword(selectedFacultyForReset.uid, newPasswordInput); alert("Done"); setResetModalOpen(false); setFaculty(await db.getFaculty()); } catch(e:any){alert(e.message);} }};
  
  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if(assignForm.facultyId && assignForm.branchId && assignForm.subjectId) {
      // Default batchId to 'ALL' if not selected
      const finalAssign = {
          ...assignForm,
          batchId: assignForm.batchId || 'ALL'
      };
      setPendingAssignment(finalAssign);
      setConfirmModalOpen(true);
    }
  };

  const confirmAssignment = async () => {
    if(pendingAssignment) { 
        if (isEditingAssignment && editingAssignmentId) {
            await db.removeAssignment(editingAssignmentId);
            await db.assignFaculty(pendingAssignment);
        } else {
            await db.assignFaculty(pendingAssignment); 
        }
        loadData(); 
        setConfirmModalOpen(false); 
        resetAssignForm();
    }
  };

  const resetAssignForm = () => {
      setAssignForm({ facultyId: '', subjectId: '', branchId: '', batchId: '' });
      setIsEditingAssignment(false);
      setEditingAssignmentId(null);
  }

  const handleDeleteAssignment = async (id: string) => { if(confirm("Remove?")) { await db.removeAssignment(id); loadData(); }};

  const handleEditAssignment = async (assignment: FacultyAssignment) => {
      setIsEditingAssignment(true);
      setEditingAssignmentId(assignment.id);
      await loadBatches(assignment.branchId);
      setAssignForm({
          facultyId: assignment.facultyId,
          branchId: assignment.branchId,
          batchId: assignment.batchId,
          subjectId: assignment.subjectId
      });
  };

  // Helper to format Context display
  const formatContext = (batchId: string) => {
     if (batchId === 'ALL') return 'All Batches';
     return batchMap[batchId] || batchId;
  };

  return (
     <div className="space-y-6">
       <div className="bg-slate-200 p-1 rounded-lg inline-flex">
          <button onClick={()=>setActiveSubTab('subjects')} className={`px-4 py-2 text-sm font-medium rounded ${activeSubTab==='subjects'?'bg-white text-indigo-600':'text-slate-600'}`}>Subjects</button>
          <button onClick={()=>setActiveSubTab('faculty_list')} className={`px-4 py-2 text-sm font-medium rounded ${activeSubTab==='faculty_list'?'bg-white text-indigo-600':'text-slate-600'}`}>Faculty</button>
          <button onClick={()=>setActiveSubTab('allocations')} className={`px-4 py-2 text-sm font-medium rounded ${activeSubTab==='allocations'?'bg-white text-indigo-600':'text-slate-600'}`}>Allocations</button>
       </div>
       {isLoadingData ? <div>Loading...</div> : (
         <>
           {activeSubTab==='subjects' && (
             <Card>
                <div className="flex gap-2 mb-4 bg-slate-50 p-4"><input placeholder="Name" className="border p-2 w-full text-slate-900 bg-white" value={newSub.name} onChange={e=>setNewSub({...newSub,name:e.target.value})}/><input placeholder="Code" className="border p-2 w-32 text-slate-900 bg-white" value={newSub.code} onChange={e=>setNewSub({...newSub,code:e.target.value})}/><Button onClick={handleAddSubject}>Add</Button></div>
                <table className="w-full text-sm text-left"><thead className="bg-slate-50 border-b"><tr><th className="p-2 text-slate-900">Code</th><th className="p-2 text-slate-900">Name</th><th className="p-2 text-right text-slate-900">Action</th></tr></thead><tbody>{subjects.map(s=><tr key={s.id} className="border-b"><td className="p-2 text-slate-900">{s.code}</td><td className="p-2 text-slate-900">{s.name}</td><td className="p-2 text-right"><button onClick={()=>handleDeleteSubject(s.id)}><Trash2 className="h-4 w-4"/></button></td></tr>)}</tbody></table>
             </Card>
           )}
           {activeSubTab==='faculty_list' && (
             <Card>
                <form onSubmit={handleAddFaculty} className="mb-4 grid grid-cols-4 gap-2 bg-slate-50 p-4"><Input label="Name" required value={newFac.name} onChange={e=>setNewFac({...newFac,name:e.target.value})} className="mb-0 text-slate-900 bg-white"/><Input label="Email" required value={newFac.email} onChange={e=>setNewFac({...newFac,email:e.target.value})} className="mb-0 text-slate-900 bg-white"/><Input label="Password" required value={newFac.password} onChange={e=>setNewFac({...newFac,password:e.target.value})} className="mb-0 text-slate-900 bg-white"/><div className="flex items-end"><Button type="submit">Add</Button></div></form>
                <table className="w-full text-sm text-left"><thead className="bg-slate-50 border-b"><tr><th className="p-2 text-slate-900">Name</th><th className="p-2 text-slate-900">Email</th><th className="p-2 text-right text-slate-900">Actions</th></tr></thead><tbody>{faculty.map(f=><tr key={f.uid} className="border-b"><td className="p-2 text-slate-900">{f.displayName}</td><td className="p-2 text-slate-900">{f.email}</td><td className="p-2 text-right flex justify-end gap-2"><button onClick={()=>initiateResetPassword(f)}><Key className="h-4 w-4"/></button><button onClick={()=>handleDeleteFaculty(f.uid)}><Trash2 className="h-4 w-4"/></button></td></tr>)}</tbody></table>
             </Card>
           )}
           {activeSubTab==='allocations' && (
              <Card>
                <div className="bg-indigo-50 p-4 rounded mb-4">
                   <div className="flex justify-between items-center mb-2">
                       <h4 className="font-semibold text-indigo-900">{isEditingAssignment ? 'Edit Assignment' : 'New Assignment'}</h4>
                       {isEditingAssignment && <button onClick={resetAssignForm} className="text-xs text-red-600 underline">Cancel Edit</button>}
                   </div>
                   <form onSubmit={handleAssign} className="grid grid-cols-5 gap-2 items-end">
                      <Select label="Faculty" value={assignForm.facultyId} onChange={e=>setAssignForm({...assignForm, facultyId:e.target.value})} className="mb-0 bg-white">{[<option key="def" value="">Select</option>, ...faculty.map(f=><option key={f.uid} value={f.uid}>{f.displayName}</option>)]}</Select>
                      <Select label="Branch" value={assignForm.branchId} onChange={e=>{setAssignForm({...assignForm, branchId:e.target.value, batchId:''}); loadBatches(e.target.value);}} className="mb-0 bg-white">{[<option key="def" value="">Select</option>, ...branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)]}</Select>
                      <Select label="Batch" value={assignForm.batchId} onChange={e=>setAssignForm({...assignForm, batchId:e.target.value})} disabled={!assignForm.branchId} className="mb-0 bg-white">{[<option key="def" value="">All Batches (Default)</option>, ...batches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)]}</Select>
                      <Select label="Subject" value={assignForm.subjectId} onChange={e=>setAssignForm({...assignForm, subjectId:e.target.value})} className="mb-0 bg-white">{[<option key="def" value="">Select</option>, ...subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)]}</Select>
                      <Button type="submit" className="col-span-5 md:col-span-1">{isEditingAssignment ? 'Update' : 'Assign'}</Button>
                   </form>
                </div>
                <table className="w-full text-sm text-left"><thead className="bg-slate-50 border-b"><tr><th className="p-2 text-slate-900">Faculty</th><th className="p-2 text-slate-900">Subject</th><th className="p-2 text-slate-900">Context</th><th className="p-2 text-right text-slate-900">Action</th></tr></thead>
                  <tbody>{assignments.map(a => {
                     const fac = faculty.find(f=>f.uid===a.facultyId);
                     const sub = subjects.find(s=>s.id===a.subjectId);
                     const br = branches.find(b=>b.id===a.branchId)?.name;
                     return (<tr key={a.id} className="border-b"><td className="p-2 text-slate-900">{fac?.displayName}</td><td className="p-2 text-slate-900">{sub?.name}</td><td className="p-2 text-xs text-slate-600">
                        <div className="font-bold">{br}</div>
                        <div>{formatContext(a.batchId)}</div>
                     </td><td className="p-2 text-right flex justify-end gap-2">
                        <button onClick={()=>handleEditAssignment(a)} className="text-blue-500 hover:text-blue-700"><Edit2 className="h-4 w-4"/></button>
                        <button onClick={()=>handleDeleteAssignment(a.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4"/></button>
                     </td></tr>)
                  })}</tbody></table>
              </Card>
           )}
         </>
       )}
       <Modal isOpen={confirmModalOpen} onClose={()=>setConfirmModalOpen(false)} title="Confirm"><div className="p-4"><p>{isEditingAssignment ? 'Update this assignment?' : 'Confirm Assignment?'}</p><div className="flex justify-end gap-2 mt-4"><Button onClick={confirmAssignment}>Yes</Button></div></div></Modal>
       <Modal isOpen={resetModalOpen} onClose={()=>setResetModalOpen(false)} title="Reset Password"><div className="p-4"><Input label="New Password" value={newPasswordInput} onChange={e=>setNewPasswordInput(e.target.value)} className="text-slate-900 bg-white" /><div className="flex justify-end gap-2 mt-4"><Button onClick={handleResetPassword}>Update</Button></div></div></Modal>
     </div>
  );
};
