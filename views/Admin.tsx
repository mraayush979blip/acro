import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Branch, Batch, User, Subject, FacultyAssignment } from '../types';
import { Card, Button, Input, Select, Modal, FileUploader } from '../components/UI';
import { Plus, Trash2, ChevronRight, Users, BookOpen, AlertCircle, Database, Edit, Eye, Info } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'students' | 'faculty'>('students');
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    if (!window.confirm("This will reset/overwrite initial data. Continue?")) return;
    setSeeding(true);
    try {
      await db.seedDatabase();
    } catch(e: any) {
      alert("Seeding failed: " + e.message);
    } finally {
      setSeeding(false);
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

      {activeTab === 'students' ? <StudentManagement /> : <FacultyManagement />}
    </div>
  );
};

// --- Sub-View: Student Management (Hierarchy) ---
const StudentManagement: React.FC = () => {
  const [level, setLevel] = useState<'branches' | 'batches' | 'students'>('branches');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  
  const [selBranch, setSelBranch] = useState<Branch | null>(null);
  const [selBatch, setSelBatch] = useState<Batch | null>(null);

  const [newItemName, setNewItemName] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch Branches on Mount
  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    const data = await db.getBranches();
    setBranches(data);
  };

  const handleSelectBranch = async (b: Branch) => {
    setSelBranch(b);
    const batchData = await db.getBatches(b.id);
    setBatches(batchData);
    setLevel('batches');
  };

  const handleSelectBatch = async (b: Batch) => {
    setSelBatch(b);
    if (selBranch) {
      const studentData = await db.getStudents(selBranch.id, b.id);
      setStudents(studentData);
    }
    setLevel('students');
  };

  const handleAdd = async () => {
    if (!newItemName) return;
    if (level === 'branches') {
      await db.addBranch(newItemName);
      loadBranches();
    } else if (level === 'batches' && selBranch) {
      await db.addBatch(newItemName, selBranch.id);
      const batchData = await db.getBatches(selBranch.id);
      setBatches(batchData);
    }
    setNewItemName('');
  };

  // CSV Import Handler
  const handleCSVUpload = async (file: File) => {
    if (!selBranch || !selBatch) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      const newStudents: Partial<User>[] = [];
      
      // Expected Format: Enrollment, RollNo, Name, Email
      // Skip header if present
      const startIndex = lines[0].toLowerCase().includes('enrollment') ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(',').map(s => s.trim());
        
        // Handle optional RollNo in CSV for backward compatibility or robust parsing
        // If 3 parts: Enrollment, Name, Email (Old)
        // If 4 parts: Enrollment, RollNo, Name, Email (New)
        
        let enroll, roll, name, email;
        
        if (parts.length >= 4) {
           [enroll, roll, name, email] = parts;
        } else if (parts.length === 3) {
           [enroll, name, email] = parts;
           roll = ''; // Empty roll if not provided
        }

        if (enroll && name && email) {
          newStudents.push({
            displayName: name,
            email: email,
            studentData: {
              branchId: selBranch.id,
              batchId: selBatch.id,
              enrollmentId: enroll,
              rollNo: roll
            }
          });
        }
      }

      if (newStudents.length > 0) {
        try {
          await db.importStudents(newStudents);
          alert(`Successfully imported ${newStudents.length} students. Accounts created with default password = Enrollment ID.`);
          const studentData = await db.getStudents(selBranch.id, selBatch.id);
          setStudents(studentData);
        } catch (err: any) {
          alert("Import failed: " + err.message);
        }
      } else {
        alert("No valid students found in CSV. Format: Enrollment, RollNo, Name, Email");
      }
      setLoading(false);
    };
    reader.readAsText(file);
  };

  // Student specific add form
  const [newStudent, setNewStudent] = useState({ name: '', email: '', enroll: '', rollNo: '' });
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selBranch || !selBatch) return;
    setLoading(true);
    try {
      await db.createStudent({
        displayName: newStudent.name,
        email: newStudent.email,
        studentData: {
          branchId: selBranch.id,
          batchId: selBatch.id,
          enrollmentId: newStudent.enroll,
          rollNo: newStudent.rollNo
        }
      });
      setNewStudent({ name: '', email: '', enroll: '', rollNo: '' });
      const studentData = await db.getStudents(selBranch.id, selBatch.id);
      setStudents(studentData);
      alert(`Student added. Account created with default password: ${newStudent.enroll}`);
    } catch (e: any) {
      alert("Error adding student: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (level === 'branches') {
      if(!window.confirm("Delete this Branch? All associated data will be lost.")) return;
      await db.deleteBranch(id);
      loadBranches();
    } else if (level === 'batches' && selBranch) {
      if(!window.confirm("Delete this Batch?")) return;
      await db.deleteBatch(id);
      const batchData = await db.getBatches(selBranch.id);
      setBatches(batchData);
    } else if (level === 'students' && selBranch && selBatch) {
      if(!window.confirm("Delete this Student?")) return;
      await db.deleteUser(id);
      const studentData = await db.getStudents(selBranch.id, selBatch.id);
      setStudents(studentData);
    }
  };

  return (
    <Card>
      {/* Breadcrumb */}
      <div className="flex items-center text-sm mb-6 text-slate-500">
        <span 
          className={`cursor-pointer hover:text-indigo-600 ${level === 'branches' ? 'font-bold text-indigo-600' : ''}`}
          onClick={() => { setLevel('branches'); setSelBranch(null); setSelBatch(null); }}
        >
          Branches
        </span>
        {selBranch && (
          <>
            <ChevronRight className="h-4 w-4 mx-2" />
            <span 
              className={`cursor-pointer hover:text-indigo-600 ${level === 'batches' ? 'font-bold text-indigo-600' : ''}`}
              onClick={() => { setLevel('batches'); setSelBatch(null); }}
            >
              {selBranch.name}
            </span>
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
              placeholder={`New ${level === 'branches' ? 'Branch' : 'Batch'} Name`} 
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="flex-grow"
            />
            <Button onClick={handleAdd}><Plus className="h-4 w-4 mr-1 inline" /> Add</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(level === 'branches' ? branches : batches).map((item) => (
              <div 
                key={item.id} 
                onClick={() => level === 'branches' ? handleSelectBranch(item as Branch) : handleSelectBatch(item as Batch)}
                className="group border border-slate-200 rounded-lg p-4 hover:border-indigo-400 hover:shadow-md cursor-pointer bg-slate-50 transition flex justify-between items-center"
              >
                <div className="flex items-center">
                  <div className="bg-white p-2 rounded-full border border-slate-200 mr-3">
                    {level === 'branches' ? <BookOpen className="h-5 w-5 text-indigo-500" /> : <Users className="h-5 w-5 text-indigo-500" />}
                  </div>
                  <span className="font-semibold text-slate-800">{item.name}</span>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                  className="text-slate-400 hover:text-red-600 p-2 transition opacity-0 group-hover:opacity-100"
                >
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
                 <Input label="Student Name" required value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} className="mb-0" />
                 <Input label="Email" type="email" required value={newStudent.email} onChange={e => setNewStudent({...newStudent, email: e.target.value})} className="mb-0" />
                 <Input label="Enrollment ID" required value={newStudent.enroll} onChange={e => setNewStudent({...newStudent, enroll: e.target.value})} className="mb-0" />
                 <Input label="Roll No" value={newStudent.rollNo} onChange={e => setNewStudent({...newStudent, rollNo: e.target.value})} className="mb-0" />
              </form>
              <div className="flex gap-2 w-full justify-end">
                <div title="Format: Enrollment, RollNo, Name, Email (CSV)">
                  <FileUploader onFileSelect={handleCSVUpload} label="Import CSV" />
                </div>
                <Button onClick={handleAddStudent} disabled={loading} className="w-full md:w-auto">{loading ? 'Adding...' : 'Add Student'}</Button>
              </div>
           </div>

           <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex items-start gap-3 text-sm text-blue-800">
             <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
             <div>
               <p className="font-semibold">Automatic Account Creation:</p>
               <p>New students are automatically registered. Default Password is their <strong>Enrollment ID</strong>.</p>
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
                     <td className="py-3 px-2 text-right">
                        <button onClick={() => handleDelete(s.uid)} className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition"><Trash2 className="h-4 w-4"/></button>
                     </td>
                   </tr>
                 ))}
                 {students.length === 0 && (
                   <tr>
                     <td colSpan={5} className="py-4 text-center text-slate-500">No students in this batch yet.</td>
                   </tr>
                 )}
               </tbody>
             </table>
           </div>
        </div>
      )}
    </Card>
  );
};

// --- Sub-View: Faculty Management ---
const FacultyManagement: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'subjects' | 'faculty_list' | 'allocations'>('subjects');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [faculty, setFaculty] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<FacultyAssignment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  // Forms
  const [newSub, setNewSub] = useState({ name: '', code: '' });
  const [newFac, setNewFac] = useState({ name: '', email: '', password: '' });
  const [assignForm, setAssignForm] = useState({ facultyId: '', subjectId: '', branchId: '', batchId: '' });

  // Edit Modal State
  const [editSubject, setEditSubject] = useState<Subject | null>(null);
  
  // View Modal State
  const [viewFacAssignments, setViewFacAssignments] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setSubjects(await db.getSubjects());
    setFaculty(await db.getFaculty());
    setAssignments(await db.getAssignments());
    setBranches(await db.getBranches());
  };

  const loadBatches = async (branchId: string) => {
    const data = await db.getBatches(branchId);
    setBatches(data);
  };

  const handleAddSubject = async () => {
    if(newSub.name && newSub.code) {
      await db.addSubject(newSub.name, newSub.code);
      setNewSub({name:'', code:''});
      setSubjects(await db.getSubjects());
    }
  };

  const handleUpdateSubject = async () => {
    if (editSubject && editSubject.name && editSubject.code) {
      await db.updateSubject(editSubject.id, editSubject.name, editSubject.code);
      setEditSubject(null);
      setSubjects(await db.getSubjects());
    }
  };

  const handleAddFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newFac.name && newFac.email && newFac.password) {
      setLoading(true);
      try {
        await db.createFaculty({ displayName: newFac.name, email: newFac.email }, newFac.password);
        setNewFac({ name: '', email: '', password: '' });
        setFaculty(await db.getFaculty());
        alert("Faculty profile and account created successfully.");
      } catch (e: any) {
        alert("Error creating faculty: " + e.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.values(assignForm).every(v => v)) {
      await db.assignFaculty(assignForm);
      setAssignments(await db.getAssignments());
      setAssignForm({ ...assignForm, subjectId: '' }); 
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if(!window.confirm("Remove this assignment?")) return;
    await db.removeAssignment(id);
    setAssignments(await db.getAssignments());
  };

  const handleDeleteSubject = async (id: string) => {
    if(!window.confirm("Delete this subject?")) return;
    await db.deleteSubject(id);
    setSubjects(await db.getSubjects());
  };

  const handleDeleteFaculty = async (uid: string) => {
    if(!window.confirm("Delete this faculty member?")) return;
    await db.deleteUser(uid);
    setFaculty(await db.getFaculty());
  };

  // Helper for assignment modal
  const getFacultyAssignments = (uid: string) => {
    return assignments.filter(a => a.facultyId === uid);
  };

  return (
    <div className="space-y-6">
      {/* Sub Navigation */}
      <div className="bg-slate-200 p-1 rounded-lg inline-flex">
        <button 
          onClick={() => setActiveSubTab('subjects')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeSubTab === 'subjects' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Subject Library
        </button>
        <button 
          onClick={() => setActiveSubTab('faculty_list')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeSubTab === 'faculty_list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Faculty Directory
        </button>
        <button 
          onClick={() => setActiveSubTab('allocations')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeSubTab === 'allocations' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Allocations
        </button>
      </div>

      {activeSubTab === 'subjects' && (
        <Card>
          <div className="flex justify-between items-center mb-6">
            <div>
               <h3 className="text-lg font-bold text-slate-800">Subjects Library</h3>
               <p className="text-sm text-slate-500">Manage global subjects available for allocation.</p>
            </div>
          </div>
          
          {/* Add Form */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 flex gap-4 items-end">
             <div className="flex-grow">
               <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Subject Name</label>
               <input 
                 className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                 placeholder="e.g. Data Structures"
                 value={newSub.name}
                 onChange={e => setNewSub({...newSub, name: e.target.value})}
               />
             </div>
             <div className="w-32">
               <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Code</label>
               <input 
                 className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                 placeholder="CS-101"
                 value={newSub.code}
                 onChange={e => setNewSub({...newSub, code: e.target.value})}
               />
             </div>
             <Button onClick={handleAddSubject} disabled={!newSub.name || !newSub.code}>Add Subject</Button>
          </div>

          {/* List */}
          <div className="border rounded-lg overflow-hidden">
             <table className="w-full text-left text-sm">
               <thead className="bg-slate-50 border-b">
                 <tr>
                   <th className="px-4 py-3 font-semibold text-slate-700">Code</th>
                   <th className="px-4 py-3 font-semibold text-slate-700">Subject Name</th>
                   <th className="px-4 py-3 text-right">Action</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {subjects.map(s => (
                   <tr key={s.id} className="hover:bg-slate-50 group">
                     <td className="px-4 py-3 font-mono text-slate-600">{s.code}</td>
                     <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                     <td className="px-4 py-3 text-right space-x-2">
                       <button onClick={() => setEditSubject(s)} className="text-slate-400 hover:text-indigo-600 transition opacity-0 group-hover:opacity-100" title="Edit">
                         <Edit className="h-4 w-4" />
                       </button>
                       <button onClick={() => handleDeleteSubject(s.id)} className="text-slate-400 hover:text-red-600 transition opacity-0 group-hover:opacity-100" title="Delete">
                         <Trash2 className="h-4 w-4" />
                       </button>
                     </td>
                   </tr>
                 ))}
                 {subjects.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">No subjects added yet.</td></tr>}
               </tbody>
             </table>
          </div>
        </Card>
      )}

      {activeSubTab === 'faculty_list' && (
        <Card>
          <div className="flex justify-between items-center mb-6">
            <div>
               <h3 className="text-lg font-bold text-slate-800">Faculty Directory</h3>
               <p className="text-sm text-slate-500">Manage faculty members and view their schedules.</p>
            </div>
          </div>

          <form onSubmit={handleAddFaculty} className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
             <Input label="Faculty Name" className="mb-0 w-full" value={newFac.name} onChange={e => setNewFac({...newFac, name: e.target.value})} required />
             <Input label="Email" type="email" className="mb-0 w-full" value={newFac.email} onChange={e => setNewFac({...newFac, email: e.target.value})} required />
             <Input label="Password" type="password" className="mb-0 w-full" value={newFac.password} onChange={e => setNewFac({...newFac, password: e.target.value})} required placeholder="Set Password" />
             <Button type="submit" disabled={loading}>{loading ? 'Adding...' : 'Add Faculty'}</Button>
          </form>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex items-start gap-3 text-sm text-blue-800 mb-6">
             <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
             <div>
               <p className="font-semibold">Automatic Account Creation:</p>
               <p>Faculty members are registered with the <strong>email and password</strong> you provide above.</p>
             </div>
           </div>

          <div className="border rounded-lg overflow-hidden">
             <table className="w-full text-left text-sm">
               <thead className="bg-slate-50 border-b">
                 <tr>
                   <th className="px-4 py-3 font-semibold text-slate-700">Name</th>
                   <th className="px-4 py-3 font-semibold text-slate-700">Email</th>
                   <th className="px-4 py-3 text-right">Actions</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {faculty.map(f => (
                   <tr key={f.uid} className="hover:bg-slate-50 group">
                     <td className="px-4 py-3 font-medium text-slate-900 flex items-center gap-3">
                       <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                          {f.displayName.charAt(0)}
                       </div>
                       {f.displayName}
                     </td>
                     <td className="px-4 py-3 text-slate-600">{f.email}</td>
                     <td className="px-4 py-3 text-right space-x-2">
                       <button 
                         onClick={() => setViewFacAssignments(f.uid)} 
                         className="text-indigo-500 hover:text-indigo-700 px-3 py-1 rounded bg-indigo-50 text-xs font-medium transition"
                       >
                         View Classes
                       </button>
                       <button onClick={() => handleDeleteFaculty(f.uid)} className="text-slate-400 hover:text-red-600 transition opacity-0 group-hover:opacity-100" title="Remove">
                         <Trash2 className="h-4 w-4" />
                       </button>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
          </div>
        </Card>
      )}

      {activeSubTab === 'allocations' && (
        <Card>
           <div className="flex justify-between items-center mb-6">
            <div>
               <h3 className="text-lg font-bold text-slate-800">Course Allocations</h3>
               <p className="text-sm text-slate-500">Assign faculty members to specific subjects in branches.</p>
            </div>
          </div>

          {/* Allocation Form */}
          <div className="bg-indigo-50 p-5 rounded-lg border border-indigo-100 mb-8">
            <h4 className="text-sm font-bold text-indigo-900 mb-3 uppercase tracking-wide">Assign New Class</h4>
            <form onSubmit={handleAssign} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
               <div className="md:col-span-1">
                 <label className="block text-xs font-semibold text-indigo-700 mb-1">Faculty</label>
                 <Select 
                   className="mb-0" 
                   value={assignForm.facultyId} 
                   onChange={e => setAssignForm({...assignForm, facultyId: e.target.value})} 
                   required
                 >
                   <option value="">Select Faculty</option>
                   {faculty.map(f => <option key={f.uid} value={f.uid}>{f.displayName}</option>)}
                 </Select>
               </div>
               
               <div className="md:col-span-1">
                 <label className="block text-xs font-semibold text-indigo-700 mb-1">Context</label>
                 <div className="flex gap-2">
                    <Select 
                      className="mb-0 w-1/2" 
                      value={assignForm.branchId} 
                      onChange={e => {
                        setAssignForm({...assignForm, branchId: e.target.value, batchId: ''});
                        loadBatches(e.target.value);
                      }}
                      required
                    >
                      <option value="">Branch</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </Select>
                    <Select 
                      className="mb-0 w-1/2" 
                      value={assignForm.batchId} 
                      onChange={e => setAssignForm({...assignForm, batchId: e.target.value})}
                      required
                      disabled={!assignForm.branchId}
                    >
                      <option value="">Batch</option>
                      {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </Select>
                 </div>
               </div>

               <div className="md:col-span-1">
                 <label className="block text-xs font-semibold text-indigo-700 mb-1">Subject</label>
                 <Select 
                   className="mb-0" 
                   value={assignForm.subjectId} 
                   onChange={e => setAssignForm({...assignForm, subjectId: e.target.value})}
                   required
                 >
                   <option value="">Select Subject</option>
                   {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                 </Select>
               </div>

               <div className="md:col-span-1">
                 <Button type="submit" className="w-full">Assign</Button>
               </div>
            </form>
          </div>

          {/* Table */}
           <div className="border rounded-lg overflow-hidden">
             <table className="w-full text-left text-sm">
               <thead className="bg-slate-50 border-b">
                 <tr>
                   <th className="px-4 py-3 font-semibold text-slate-700">Faculty Name</th>
                   <th className="px-4 py-3 font-semibold text-slate-700">Subject</th>
                   <th className="px-4 py-3 font-semibold text-slate-700">Class Context</th>
                   <th className="px-4 py-3 text-right">Remove</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {assignments.map(a => {
                   const fac = faculty.find(f => f.uid === a.facultyId);
                   const sub = subjects.find(s => s.id === a.subjectId);
                   const br = branches.find(b => b.id === a.branchId);
                   const ba = batches.find(b => b.id === a.batchId);

                   return (
                    <tr key={a.id} className="hover:bg-slate-50 group">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <div className="flex items-center">
                          <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs mr-2 font-bold">
                            {fac?.displayName.charAt(0)}
                          </div>
                          {fac?.displayName || 'Unknown'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{sub?.name} <span className="text-slate-400 text-xs">({sub?.code})</span></td>
                      <td className="px-4 py-3 text-slate-600">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-xs border border-slate-200">
                          {br?.name} &bull; {ba?.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleDeleteAssignment(a.id)} className="text-slate-400 hover:text-red-600 transition opacity-0 group-hover:opacity-100">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                   );
                 })}
                 {assignments.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No active assignments.</td></tr>}
               </tbody>
             </table>
          </div>
        </Card>
      )}

      {/* MODAL: Edit Subject */}
      <Modal isOpen={!!editSubject} onClose={() => setEditSubject(null)} title="Edit Subject">
         <div className="space-y-4">
            <Input 
              label="Subject Name" 
              value={editSubject?.name || ''} 
              onChange={e => setEditSubject(prev => prev ? ({...prev, name: e.target.value}) : null)} 
            />
            <Input 
              label="Subject Code" 
              value={editSubject?.code || ''} 
              onChange={e => setEditSubject(prev => prev ? ({...prev, code: e.target.value}) : null)} 
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" onClick={() => setEditSubject(null)}>Cancel</Button>
              <Button onClick={handleUpdateSubject}>Save Changes</Button>
            </div>
         </div>
      </Modal>

      {/* MODAL: View Faculty Assignments */}
      <Modal isOpen={!!viewFacAssignments} onClose={() => setViewFacAssignments(null)} title="Assigned Classes">
         <div className="space-y-4">
           {viewFacAssignments && (
             <div className="border rounded-md overflow-hidden">
               <table className="w-full text-sm">
                 <thead className="bg-slate-50 border-b">
                   <tr>
                     <th className="px-3 py-2 text-left">Subject</th>
                     <th className="px-3 py-2 text-left">Class</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y">
                   {getFacultyAssignments(viewFacAssignments).map(a => {
                     const sub = subjects.find(s => s.id === a.subjectId);
                     const br = branches.find(b => b.id === a.branchId);
                     const ba = batches.find(b => b.id === a.batchId);
                     return (
                       <tr key={a.id}>
                         <td className="px-3 py-2">
                           <div className="font-medium text-slate-900">{sub?.name}</div>
                           <div className="text-xs text-slate-500">{sub?.code}</div>
                         </td>
                         <td className="px-3 py-2 text-slate-600">
                           {br?.name} <span className="text-slate-300">|</span> {ba?.name}
                         </td>
                       </tr>
                     );
                   })}
                   {getFacultyAssignments(viewFacAssignments).length === 0 && (
                     <tr><td colSpan={2} className="p-4 text-center text-slate-500">No classes assigned.</td></tr>
                   )}
                 </tbody>
               </table>
             </div>
           )}
           <div className="flex justify-end">
             <Button variant="secondary" onClick={() => setViewFacAssignments(null)}>Close</Button>
           </div>
         </div>
      </Modal>
    </div>
  );
};