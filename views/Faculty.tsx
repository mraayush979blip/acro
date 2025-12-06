import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../services/db';
import { User, FacultyAssignment, AttendanceRecord } from '../types';
import { Card, Button, Select } from '../components/UI';
import { Calendar, Save, Users, AlertCircle, BookOpen, Check, X, ChevronRight, ArrowLeft, BarChart3, Clock, History, CalendarDays } from 'lucide-react';

interface FacultyProps {
  user: User;
}

type Step = 'BRANCH' | 'BATCH' | 'SUBJECT' | 'DASHBOARD';
type DashboardMode = 'MENU' | 'MARK' | 'HISTORY';

export const FacultyDashboard: React.FC<FacultyProps> = ({ user }) => {
  // --- Data State ---
  const [assignments, setAssignments] = useState<FacultyAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [metaData, setMetaData] = useState<{
    branches: Record<string, string>;
    batches: Record<string, string>;
    subjects: Record<string, {name: string, code: string}>;
  }>({ branches: {}, batches: {}, subjects: {} });

  // --- Wizard State ---
  const [step, setStep] = useState<Step>('BRANCH');
  const [selBranchId, setSelBranchId] = useState('');
  const [selBatchId, setSelBatchId] = useState('');
  const [selSubjectId, setSelSubjectId] = useState('');
  
  // --- Dashboard State ---
  const [mode, setMode] = useState<DashboardMode>('MENU');
  
  // --- Marking State ---
  const [students, setStudents] = useState<User[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('');

  // --- History State ---
  const [historyStats, setHistoryStats] = useState<{uid: string; name: string; roll: string; total: number; present: number; percent: number}[]>([]);
  const [allClassRecords, setAllClassRecords] = useState<AttendanceRecord[]>([]); // Store raw records for detail view
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null); // For detail view

  // 1. Load Initial Data & Assignments
  useEffect(() => {
    const init = async () => {
      setLoadingAssignments(true);
      try {
        const [myAssignments, allBranches, allBatches, allSubjects] = await Promise.all([
          db.getAssignments(user.uid),
          db.getBranches(),
          db.getBatches(''), 
          db.getSubjects()
        ]);

        const branchMap: Record<string, string> = {};
        allBranches.forEach(b => branchMap[b.id] = b.name);

        const batchMap: Record<string, string> = {};
        allBatches.forEach(b => batchMap[b.id] = b.name);

        const subjectMap: Record<string, {name: string, code: string}> = {};
        allSubjects.forEach(s => subjectMap[s.id] = { name: s.name, code: s.code });

        setMetaData({ branches: branchMap, batches: batchMap, subjects: subjectMap });
        setAssignments(myAssignments);
      } finally {
        setLoadingAssignments(false);
      }
    };
    init();
  }, [user.uid]);

  // 2. Load Class Data (Students) when entering Dashboard
  useEffect(() => {
    if (step === 'DASHBOARD' && selBranchId && selBatchId) {
      const loadClass = async () => {
        setLoadingStudents(true);
        const data = await db.getStudents(selBranchId, selBatchId);
        setStudents(data);
        setLoadingStudents(false);
      };
      loadClass();
    }
  }, [step, selBranchId, selBatchId]);

  // 3. Load Attendance for Marking Mode
  useEffect(() => {
    if (mode === 'MARK' && step === 'DASHBOARD') {
      const fetchDailyRecord = async () => {
        const records = await db.getAttendance(selBranchId, selBatchId, selSubjectId, attendanceDate);
        const statusMap: Record<string, boolean> = {};
        
        // Default to true (Present) for all students if no record exists
        students.forEach(s => statusMap[s.uid] = true);
        
        // Overwrite with existing records
        records.forEach(r => statusMap[r.studentId] = r.isPresent);
        
        setAttendanceStatus(statusMap);
      };
      fetchDailyRecord();
    }
  }, [mode, attendanceDate, students, selBranchId, selBatchId, selSubjectId]);

  // 4. Load History Stats
  useEffect(() => {
    if (mode === 'HISTORY' && step === 'DASHBOARD') {
      const fetchHistory = async () => {
        setLoadingHistory(true);
        // Fetch ALL records for this subject/class (no date filter)
        const allRecords = await db.getAttendance(selBranchId, selBatchId, selSubjectId);
        setAllClassRecords(allRecords); // Save raw data for detailed view
        
        const stats = students.map(s => {
          const studentRecords = allRecords.filter(r => r.studentId === s.uid);
          const total = studentRecords.length;
          const present = studentRecords.filter(r => r.isPresent).length;
          const percent = total === 0 ? 0 : Math.round((present / total) * 100);
          return {
            uid: s.uid,
            name: s.displayName,
            roll: s.studentData?.rollNo || s.studentData?.enrollmentId || '-',
            total,
            present,
            percent
          };
        });
        setHistoryStats(stats);
        setLoadingHistory(false);
      };
      fetchHistory();
    }
  }, [mode, step, selBranchId, selBatchId, selSubjectId, students]);

  // --- Wizard Logic ---

  // Get available Branches
  const availableBranches = useMemo(() => {
    const ids = Array.from(new Set(assignments.map(a => a.branchId)));
    return ids.map(id => ({ id, name: metaData.branches[id] }));
  }, [assignments, metaData]);

  // Get available Batches for selected Branch
  const availableBatches = useMemo(() => {
    const relevant = assignments.filter(a => a.branchId === selBranchId);
    const ids = Array.from(new Set(relevant.map(a => a.batchId)));
    return ids.map(id => ({ id, name: metaData.batches[id] }));
  }, [assignments, selBranchId, metaData]);

  // Get available Subjects for selected Branch & Batch
  const availableSubjects = useMemo(() => {
    const relevant = assignments.filter(a => a.branchId === selBranchId && a.batchId === selBatchId);
    return relevant.map(a => ({ 
      id: a.subjectId, 
      name: metaData.subjects[a.subjectId]?.name, 
      code: metaData.subjects[a.subjectId]?.code 
    }));
  }, [assignments, selBranchId, selBatchId, metaData]);

  const selectBranch = (id: string) => {
    setSelBranchId(id);
    setStep('BATCH');
  };

  const selectBatch = (id: string) => {
    setSelBatchId(id);
    
    // Check assignments to see if we skip Subject selection
    const relevantAssignments = assignments.filter(a => a.branchId === selBranchId && a.batchId === id);
    if (relevantAssignments.length === 1) {
      // Auto-skip logic
      setSelSubjectId(relevantAssignments[0].subjectId);
      setStep('DASHBOARD');
      setMode('MENU');
    } else {
      setStep('SUBJECT');
    }
  };

  const selectSubject = (id: string) => {
    setSelSubjectId(id);
    setStep('DASHBOARD');
    setMode('MENU');
  };

  const goBack = () => {
    if (mode === 'HISTORY' && selectedStudent) {
      setSelectedStudent(null);
      return;
    }

    if (mode !== 'MENU') {
      setMode('MENU');
      return;
    }
    
    if (step === 'DASHBOARD') {
      // If we auto-skipped subject, go back to batch
      const relevantAssignments = assignments.filter(a => a.branchId === selBranchId && a.batchId === selBatchId);
      if (relevantAssignments.length === 1) {
        setStep('BATCH');
        setSelBatchId('');
        setSelSubjectId('');
      } else {
        setStep('SUBJECT');
        setSelSubjectId('');
      }
    } else if (step === 'SUBJECT') {
      setStep('BATCH');
      setSelBatchId('');
    } else if (step === 'BATCH') {
      setStep('BRANCH');
      setSelBranchId('');
    }
  };

  // --- Marking Handlers ---
  const handleSave = async () => {
    const previousMessage = message;
    setMessage('Saving...');
    try {
      const records: AttendanceRecord[] = students.map(s => ({
        id: `${attendanceDate}_${s.uid}_${selSubjectId}`,
        date: attendanceDate,
        studentId: s.uid,
        subjectId: selSubjectId,
        branchId: selBranchId,
        batchId: selBatchId,
        facultyId: user.uid,
        isPresent: attendanceStatus[s.uid],
        markedBy: user.uid,
        timestamp: Date.now()
      }));

      await db.saveAttendance(records);
      setMessage('✓ Saved');
      setTimeout(() => setMessage(''), 3000);
    } catch (e) {
      setMessage('Error saving');
      setTimeout(() => setMessage(previousMessage), 3000);
    }
  };

  const toggleStatus = (uid: string) => {
    setAttendanceStatus(prev => ({ ...prev, [uid]: !prev[uid] }));
  };

  const markAll = (present: boolean) => {
    const newStatus = { ...attendanceStatus };
    students.forEach(s => newStatus[s.uid] = present);
    setAttendanceStatus(newStatus);
  };

  const presentCount = Object.values(attendanceStatus).filter(Boolean).length;

  if (loadingAssignments) {
    return <div className="p-12 text-center text-slate-500">Loading your schedule...</div>;
  }

  // --- RENDER WIZARD STEPS ---

  const renderBreadcrumb = () => (
    <div className="flex items-center text-sm text-slate-500 mb-6 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
      {step !== 'BRANCH' && (
        <button onClick={goBack} className="mr-3 p-1 hover:bg-slate-100 rounded-full text-slate-700">
          <ArrowLeft className="h-4 w-4" />
        </button>
      )}
      <div className="flex items-center flex-wrap">
        <span className={step === 'BRANCH' ? 'font-bold text-indigo-700' : ''}>Branch</span>
        {selBranchId && (
          <>
            <ChevronRight className="h-4 w-4 mx-2 text-slate-400" />
            <span className={step === 'BATCH' ? 'font-bold text-indigo-700' : ''}>{metaData.branches[selBranchId]}</span>
          </>
        )}
        {selBatchId && (
          <>
            <ChevronRight className="h-4 w-4 mx-2 text-slate-400" />
            <span className={step === 'SUBJECT' ? 'font-bold text-indigo-700' : ''}>{metaData.batches[selBatchId]}</span>
          </>
        )}
        {selSubjectId && (
           <>
            <ChevronRight className="h-4 w-4 mx-2 text-slate-400" />
            <span className="font-bold text-indigo-700">{metaData.subjects[selSubjectId]?.name}</span>
          </>
        )}
      </div>
    </div>
  );

  // STEP 1: BRANCH
  if (step === 'BRANCH') {
    return (
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Select Branch</h2>
        {availableBranches.length === 0 ? (
          <div className="p-8 bg-white text-center rounded-lg border border-dashed text-slate-500">
             No classes assigned to you yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableBranches.map(b => (
              <div 
                key={b.id} 
                onClick={() => selectBranch(b.id)}
                className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-500 cursor-pointer transition-all group"
              >
                <div className="bg-indigo-50 w-12 h-12 rounded-full flex items-center justify-center mb-4 group-hover:bg-indigo-600 transition-colors">
                  <BookOpen className="h-6 w-6 text-indigo-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-bold text-lg text-slate-800 group-hover:text-indigo-700">{b.name}</h3>
                <p className="text-sm text-slate-500 mt-1">Select to view batches</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // STEP 2: BATCH
  if (step === 'BATCH') {
    return (
      <div className="max-w-4xl mx-auto">
        {renderBreadcrumb()}
        <h2 className="text-xl font-bold text-slate-800 mb-4">Select Batch</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableBatches.map(b => (
            <div 
              key={b.id} 
              onClick={() => selectBatch(b.id)}
              className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-500 cursor-pointer transition-all group"
            >
              <div className="bg-teal-50 w-12 h-12 rounded-full flex items-center justify-center mb-4 group-hover:bg-teal-600 transition-colors">
                <Users className="h-6 w-6 text-teal-600 group-hover:text-white transition-colors" />
              </div>
              <h3 className="font-bold text-lg text-slate-800 group-hover:text-teal-700">{b.name}</h3>
              <p className="text-sm text-slate-500 mt-1">Select to view subjects</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // STEP 3: SUBJECT
  if (step === 'SUBJECT') {
    return (
      <div className="max-w-4xl mx-auto">
        {renderBreadcrumb()}
        <h2 className="text-xl font-bold text-slate-800 mb-4">Select Subject</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableSubjects.map(s => (
            <div 
              key={s.id} 
              onClick={() => selectSubject(s.id)}
              className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-500 cursor-pointer transition-all group"
            >
              <div className="bg-purple-50 w-12 h-12 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-600 transition-colors">
                <BookOpen className="h-6 w-6 text-purple-600 group-hover:text-white transition-colors" />
              </div>
              <h3 className="font-bold text-lg text-slate-800 group-hover:text-purple-700">{s.name}</h3>
              <p className="text-sm font-mono text-slate-400 mt-1">{s.code}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // STEP 4: DASHBOARD (Menu / Mark / History)
  if (step === 'DASHBOARD') {
    return (
      <div className="max-w-5xl mx-auto pb-24">
        {/* If we are viewing a specific student history, show a custom header/back button */}
        {!selectedStudent ? renderBreadcrumb() : (
           <div className="flex items-center text-sm text-slate-500 mb-6 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
             <button onClick={goBack} className="mr-3 p-1 hover:bg-slate-100 rounded-full text-slate-700 flex items-center gap-1 font-medium">
               <ArrowLeft className="h-4 w-4" /> Back to List
             </button>
             <span className="text-slate-300 mx-2">|</span>
             <span className="font-bold text-indigo-700">{selectedStudent.displayName}</span>
           </div>
        )}
        
        {/* DASHBOARD MENU */}
        {mode === 'MENU' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div 
              onClick={() => setMode('HISTORY')}
              className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 cursor-pointer transition-all flex flex-col items-center text-center group"
            >
              <div className="h-20 w-20 bg-blue-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BarChart3 className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">View History</h3>
              <p className="text-slate-500">Analyze attendance records and view student statistics.</p>
            </div>

            <div 
              onClick={() => setMode('MARK')}
              className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 cursor-pointer transition-all flex flex-col items-center text-center group"
            >
               <div className="h-20 w-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Clock className="h-10 w-10 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Mark Attendance</h3>
              <p className="text-slate-500">Take attendance for today or modify a previous date.</p>
            </div>
          </div>
        )}

        {/* MARKING INTERFACE */}
        {mode === 'MARK' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
             <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-4 flex items-center justify-between">
                <h3 className="font-bold text-lg flex items-center">
                  <Clock className="h-5 w-5 mr-2 text-indigo-600" /> 
                  Mark Attendance
                </h3>
                <div className="flex items-center gap-2">
                   <span className="text-sm text-slate-500">Date:</span>
                   <input 
                    type="date" 
                    value={attendanceDate}
                    onChange={e => setAttendanceDate(e.target.value)}
                    className="border border-slate-300 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                   />
                </div>
             </div>

             <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                {loadingStudents ? (
                   <div className="p-12 text-center text-slate-500">Loading student list...</div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase w-24">Roll No</th>
                            <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Student Name</th>
                            <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-right w-32">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {students.map(s => {
                            const isPresent = attendanceStatus[s.uid];
                            return (
                              <tr 
                                key={s.uid} 
                                onClick={() => toggleStatus(s.uid)}
                                className={`cursor-pointer transition-colors ${isPresent ? 'hover:bg-slate-50' : 'bg-red-50/50 hover:bg-red-50'}`}
                              >
                                <td className="px-4 py-3 font-mono text-sm text-slate-600">{s.studentData?.rollNo || s.studentData?.enrollmentId}</td>
                                <td className="px-4 py-3 text-sm font-medium text-slate-900">{s.displayName}</td>
                                <td className="px-4 py-3 text-right">
                                  <div className={`relative inline-flex h-6 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${isPresent ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isPresent ? 'translate-x-6' : 'translate-x-0'}`}>
                                      {isPresent ? <Check className="h-3 w-3 text-indigo-600 m-1" /> : <X className="h-3 w-3 text-slate-400 m-1" />}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
             </div>
             
             {/* Sticky Footer for Save */}
             {students.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-3 z-30">
                  <div className="container mx-auto max-w-5xl flex justify-between items-center">
                    <div className="text-sm font-medium hidden md:block">
                      <span className="text-indigo-600 font-bold">{presentCount}</span> Present / <span className="text-slate-900 font-bold">{students.length}</span> Total
                    </div>
                    <div className="flex gap-3 w-full md:w-auto justify-between md:justify-end">
                      <div className="flex bg-slate-100 rounded p-1">
                        <button onClick={() => markAll(true)} className="px-3 py-1.5 text-xs font-semibold hover:bg-white rounded transition">All Present</button>
                        <button onClick={() => markAll(false)} className="px-3 py-1.5 text-xs font-semibold hover:bg-white rounded transition">All Absent</button>
                      </div>
                      <Button onClick={handleSave} className="flex items-center space-x-2 px-6">
                        <Save className="h-4 w-4" />
                        <span>{message || 'Save Attendance'}</span>
                      </Button>
                    </div>
                  </div>
                </div>
             )}
          </div>
        )}

        {/* HISTORY INTERFACE */}
        {mode === 'HISTORY' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
             {!selectedStudent ? (
               <>
                 <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-4 flex items-center justify-between">
                    <h3 className="font-bold text-lg flex items-center">
                      <History className="h-5 w-5 mr-2 text-blue-600" /> 
                      Attendance History
                    </h3>
                    <div className="text-sm text-slate-500">
                      Click on a student to view calendar
                    </div>
                 </div>

                 <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    {loadingHistory ? (
                       <div className="p-12 text-center text-slate-500">Calculating statistics...</div>
                    ) : (
                       <table className="w-full text-left border-collapse">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase w-24">Roll No</th>
                              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Student Name</th>
                              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-center">Classes Held</th>
                              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-center">Attended</th>
                              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-right">Percentage</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {historyStats.map(s => {
                              const studentObj = students.find(stu => stu.uid === s.uid);
                              return (
                                <tr 
                                  key={s.uid} 
                                  onClick={() => studentObj && setSelectedStudent(studentObj)}
                                  className="hover:bg-slate-50 cursor-pointer group transition-colors"
                                  title="View detailed attendance"
                                >
                                   <td className="px-4 py-3 font-mono text-sm text-slate-600 group-hover:text-indigo-600">{s.roll}</td>
                                   <td className="px-4 py-3 text-sm font-medium text-slate-900 group-hover:text-indigo-600">{s.name}</td>
                                   <td className="px-4 py-3 text-sm text-center text-slate-600">{s.total}</td>
                                   <td className="px-4 py-3 text-sm text-center text-slate-600">{s.present}</td>
                                   <td className="px-4 py-3 text-right">
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.percent < 75 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                        {s.percent}%
                                      </span>
                                      <ChevronRight className="inline-block ml-2 h-4 w-4 text-slate-300 group-hover:text-indigo-500" />
                                   </td>
                                </tr>
                              );
                            })}
                            {historyStats.length === 0 && (
                              <tr><td colSpan={5} className="p-8 text-center text-slate-400">No records found.</td></tr>
                            )}
                          </tbody>
                       </table>
                    )}
                 </div>
               </>
             ) : (
               // DETAIL VIEW FOR SELECTED STUDENT
               <>
                 <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                       <div>
                          <h2 className="text-2xl font-bold text-slate-900 mb-1">{selectedStudent.displayName}</h2>
                          <div className="flex gap-4 text-sm text-slate-500 font-mono">
                             <span>Roll: {selectedStudent.studentData?.rollNo || '-'}</span>
                             <span>Enrollment: {selectedStudent.studentData?.enrollmentId}</span>
                          </div>
                       </div>
                       
                       {/* Mini Stats for this student */}
                       {(() => {
                         const stats = historyStats.find(s => s.uid === selectedStudent.uid);
                         if (!stats) return null;
                         return (
                           <div className="flex gap-4">
                              <div className="text-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                                 <div className="text-xs text-slate-500 uppercase font-bold">Held</div>
                                 <div className="text-xl font-bold text-slate-800">{stats.total}</div>
                              </div>
                              <div className="text-center bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                                 <div className="text-xs text-emerald-600 uppercase font-bold">Attended</div>
                                 <div className="text-xl font-bold text-emerald-700">{stats.present}</div>
                              </div>
                              <div className={`text-center p-3 rounded-lg border ${stats.percent < 75 ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
                                 <div className={`text-xs uppercase font-bold ${stats.percent < 75 ? 'text-red-600' : 'text-blue-600'}`}>Percent</div>
                                 <div className={`text-xl font-bold ${stats.percent < 75 ? 'text-red-700' : 'text-blue-700'}`}>{stats.percent}%</div>
                              </div>
                           </div>
                         );
                       })()}
                    </div>
                 </div>

                 <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center">
                       <CalendarDays className="h-5 w-5 mr-2 text-indigo-600" />
                       Class Session Log
                    </h3>
                    
                    {(() => {
                      const studentRecords = allClassRecords
                         .filter(r => r.studentId === selectedStudent.uid)
                         .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                         
                      if (studentRecords.length === 0) return <div className="text-slate-500 italic">No attendance records found.</div>;

                      return (
                         <div className="border border-slate-200 rounded-lg overflow-hidden">
                           <table className="w-full text-sm text-left">
                             <thead className="bg-slate-50 border-b border-slate-200">
                               <tr>
                                 <th className="px-4 py-2 font-semibold text-slate-600">Date</th>
                                 <th className="px-4 py-2 font-semibold text-slate-600 text-center">Day</th>
                                 <th className="px-4 py-2 font-semibold text-slate-600 text-right">Status</th>
                               </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-100">
                               {studentRecords.map(r => {
                                 const dateObj = new Date(r.date);
                                 const day = dateObj.getDate();
                                 const month = dateObj.toLocaleString('default', { month: 'short' });
                                 const year = dateObj.getFullYear();
                                 const weekday = dateObj.toLocaleString('default', { weekday: 'short' });
                                 
                                 return (
                                   <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                     <td className="px-4 py-2">
                                       <span className="font-bold text-slate-800 mr-1">{day} {month}</span>
                                       <span className="text-xs text-slate-400">{year}</span>
                                     </td>
                                     <td className="px-4 py-2 text-center text-slate-500">
                                       {weekday}
                                     </td>
                                     <td className="px-4 py-2 text-right">
                                       <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${r.isPresent ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                          {r.isPresent ? 'Present' : 'Absent'}
                                       </span>
                                     </td>
                                   </tr>
                                 );
                               })}
                             </tbody>
                           </table>
                         </div>
                      );
                    })()}
                 </div>
               </>
             )}
          </div>
        )}

      </div>
    );
  }

  return null;
};