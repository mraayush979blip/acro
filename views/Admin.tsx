import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Branch, Batch, User, Subject, FacultyAssignment, UserRole } from '../types';
import { Card, Button, Input, Select } from '../components/UI';
import { Plus, Trash2, ChevronRight, UserPlus, Users, BookOpen, AlertCircle, Database } from 'lucide-react';

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

  const handleBack = () => {
    if (level === 'students') setLevel('batches');
    else if (level === 'batches') {
      setSelBranch(null);
      setLevel('branches');
    }
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

  // Student specific add form
  const [newStudent, setNewStudent] = useState({ name: '', email: '', enroll: '' });
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selBranch || !selBatch) return;
    await db.createStudent({
      displayName: newStudent.name,
      email: newStudent.email,
      studentData: {
        branchId: selBranch.id,
        batchId: selBatch.id,
        enrollmentId: newStudent.enroll
      }
    });
    setNewStudent({ name: '', email: '', enroll: '' });
    const studentData = await db.getStudents(selBranch.id, selBatch.id);
    setStudents(studentData);
  };

  const handleDelete = async (id: string) => {
    if(!window.confirm("Are you sure?")) return;
    if (level === 'branches') {
      await db.deleteBranch(id);
      loadBranches();
    } else if (level === 'batches' && selBranch) {
      await db.deleteBatch(id);
      const batchData = await db.getBatches(selBranch.id);
      setBatches(batchData);
    } else if (level === 'students' && selBranch && selBatch) {
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
                  className="text-slate-400 hover:text-red-600 p-2 opacity-0 group-hover:opacity-100 transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
           <form onSubmit={handleAddStudent} className="bg-slate-50 p-4 rounded-md border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <Input label="Student Name" required value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} />
              <Input label="Email" type="email" required value={newStudent.email} onChange={e => setNewStudent({...newStudent, email: e.target.value})} />
              <Input label="Enrollment ID" required value={newStudent.enroll} onChange={e => setNewStudent({...newStudent, enroll: e.target.value})} />
              <Button type="submit" className="mb-3">Add Student</Button>
           </form>

           <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex items-start gap-3 text-sm text-amber-800">
             <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
             <div>
               <p className="font-semibold">Action Required for Login:</p>
               <p>This form creates the student's <strong>data profile</strong>. To allow them to log in, you must manually create a user with this email in the <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="underline hover:text-amber-900">Firebase Console &gt; Authentication</a> tab.</p>
             </div>
           </div>

           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="border-b border-slate-300 text-slate-600 text-sm">
                   <th className="py-2 px-2">Enrollment</th>
                   <th className="py-2 px-2">Name</th>
                   <th className="py-2 px-2">Email</th>
                   <th className="py-2 px-2 text-right">Actions</th>
                 </tr>
               </thead>
               <tbody>
                 {students.map(s => (
                   <tr key={s.uid} className="border-b border-slate-100 hover:bg-slate-50">
                     <td className="py-3 px-2 font-mono text-sm text-slate-700">{s.studentData?.enrollmentId}</td>
                     <td className="py-3 px-2 font-medium text-slate-900">{s.displayName}</td>
                     <td className="py-3 px-2 text-slate-600">{s.email}</td>
                     <td className="py-3 px-2 text-right">
                        <button onClick={() => handleDelete(s.uid)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4"/></button>
                     </td>
                   </tr>
                 ))}
                 {students.length === 0 && (
                   <tr>
                     <td colSpan={4} className="py-4 text-center text-slate-500">No students in this batch yet.</td>
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
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [faculty, setFaculty] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<FacultyAssignment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  const [newSub, setNewSub] = useState({ name: '', code: '' });
  const [assignForm, setAssignForm] = useState({ facultyId: '', subjectId: '', branchId: '', batchId: '' });

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

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.values(assignForm).every(v => v)) {
      await db.assignFaculty(assignForm);
      setAssignments(await db.getAssignments());
      setAssignForm({ ...assignForm, subjectId: '' }); // Clear subject to allow rapid entry
    }
  };

  const handleDeleteAssignment = async (id: string) => {
     await db.removeAssignment(id);
     setAssignments(await db.getAssignments());
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Subjects Column */}
      <div className="space-y-6">
        <Card>
          <h3 className="font-bold text-slate-800 mb-4">Manage Subjects</h3>
          <div className="flex gap-2 mb-4">
            <Input placeholder="Subject Name" value={newSub.name} onChange={e => setNewSub({...newSub, name: e.target.value})} />
            <Input placeholder="Code" className="w-24" value={newSub.code} onChange={e => setNewSub({...newSub, code: e.target.value})} />
            <Button onClick={handleAddSubject} className="mb-3"><Plus className="h-4 w-4"/></Button>
          </div>
          <div className="max-h-64 overflow-y-auto">
             {subjects.map(s => (
               <div key={s.id} className="flex justify-between items-center p-3 border-b border-slate-100">
                 <div>
                   <span className="font-bold text-slate-900 block">{s.name}</span>
                   <span className="text-xs text-slate-500 bg-slate-100 px-1 rounded">{s.code}</span>
                 </div>
                 <button onClick={async () => { await db.deleteSubject(s.id); setSubjects(await db.getSubjects()); }} className="text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4"/></button>
               </div>
             ))}
          </div>
        </Card>
      </div>

      {/* Faculty Assignment Column */}
      <div className="space-y-6">
        <Card>
          <h3 className="font-bold text-slate-800 mb-4">Assign Faculty</h3>
          <form onSubmit={handleAssign} className="space-y-3 mb-6">
            <Select 
              value={assignForm.facultyId} 
              onChange={e => setAssignForm({...assignForm, facultyId: e.target.value})}
              required
            >
              <option value="">Select Faculty</option>
              {faculty.map(f => <option key={f.uid} value={f.uid}>{f.displayName}</option>)}
            </Select>

            <div className="grid grid-cols-2 gap-2">
              <Select 
                value={assignForm.branchId} 
                onChange={e => {
                  setAssignForm({...assignForm, branchId: e.target.value, batchId: ''});
                  loadBatches(e.target.value);
                }}
                required
              >
                <option value="">Select Branch</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
              
              <Select 
                value={assignForm.batchId} 
                onChange={e => setAssignForm({...assignForm, batchId: e.target.value})}
                required
                disabled={!assignForm.branchId}
              >
                <option value="">Select Batch</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </div>

            <Select 
              value={assignForm.subjectId} 
              onChange={e => setAssignForm({...assignForm, subjectId: e.target.value})}
              required
            >
              <option value="">Select Subject to Teach</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>

            <Button type="submit" className="w-full">Assign Class</Button>
          </form>
          
          <h4 className="text-sm font-semibold text-slate-600 mb-2 border-b pb-1">Current Assignments</h4>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {assignments.map(a => {
              const fac = faculty.find(f => f.uid === a.facultyId);
              const sub = subjects.find(s => s.id === a.subjectId);
              const batch = branches.find(b => b.id === a.branchId)?.name.split(' ')[0] + ' / ' + batches.find(b => b.id === a.batchId)?.name;
              
              return (
                <div key={a.id} className="text-sm border border-slate-200 p-2 rounded bg-slate-50 flex justify-between items-start">
                  <div>
                    <div className="font-bold text-indigo-700">{fac?.displayName || 'Unknown'}</div>
                    <div className="text-slate-800">{sub?.name}</div>
                    <div className="text-xs text-slate-500 mt-1">{batch}</div>
                  </div>
                  <button onClick={() => handleDeleteAssignment(a.id)} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4"/></button>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};