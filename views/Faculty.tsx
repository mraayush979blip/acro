
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../services/db';
import { User, FacultyAssignment, AttendanceRecord } from '../types';
import { Card, Button, Select, Input, Modal } from '../components/UI';
import { Calendar, Save, Users, AlertCircle, BookOpen, Check, X, ChevronRight, ArrowLeft, BarChart3, Clock, History, CalendarDays, ExternalLink, GraduationCap } from 'lucide-react';

interface FacultyProps {
  user: User;
}

type Step = 'BRANCH' | 'BATCH' | 'SUBJECT' | 'DASHBOARD';
type DashboardMode = 'MENU' | 'MARK' | 'HISTORY';

export const FacultyDashboard: React.FC<FacultyProps> = ({ user }) => {
  const [assignments, setAssignments] = useState<FacultyAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  
  // Metadata Maps
  const [metaData, setMetaData] = useState<{
    branches: Record<string, string>;
    batches: Record<string, string>;
    subjects: Record<string, {name: string, code: string}>;
  }>({ branches: {}, batches: {}, subjects: {} });

  const [step, setStep] = useState<Step>('BRANCH');
  const [selBranchId, setSelBranchId] = useState('');
  const [selBatchId, setSelBatchId] = useState('');
  const [selSubjectId, setSelSubjectId] = useState('');
  
  const [mode, setMode] = useState<DashboardMode>('MENU');
  
  const [students, setStudents] = useState<User[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSlots, setSelectedSlots] = useState<number[]>([1]);
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('');

  const [historyStats, setHistoryStats] = useState<any[]>([]);
  const [allClassRecords, setAllClassRecords] = useState<AttendanceRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);

  useEffect(() => {
    const init = async () => {
      setLoadingAssignments(true);
      try {
        const myAssignments = await db.getAssignments(user.uid);
        
        const [allBranches, allSubjects] = await Promise.all([db.getBranches(), db.getSubjects()]);
        
        const involvedBranchIds = Array.from(new Set(myAssignments.map(a => a.branchId)));
        
        const branchMap: Record<string, string> = {};
        allBranches.forEach(b => branchMap[b.id] = b.name);

        const batchMap: Record<string, string> = {};
        // Fetch batches for involved branches
        for (const bid of involvedBranchIds) {
             const bts = await db.getBatches(bid);
             bts.forEach(b => batchMap[b.id] = b.name);
        }

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

  // Load Students
  useEffect(() => {
    if (step === 'DASHBOARD' && selBranchId && selBatchId) {
      const loadClass = async () => {
        setLoadingStudents(true);
        const data = await db.getStudents(selBranchId, selBatchId);
        
        const sortedData = data.sort((a, b) => {
           const rollA = a.studentData?.rollNo || a.studentData?.enrollmentId || '';
           const rollB = b.studentData?.rollNo || b.studentData?.enrollmentId || '';
           return rollA.localeCompare(rollB, undefined, { numeric: true, sensitivity: 'base' });
        });
        
        setStudents(sortedData);
        setLoadingStudents(false);
      };
      loadClass();
    }
  }, [step, selBranchId, selBatchId]);

  // Load Attendance Status
  useEffect(() => {
    if (mode === 'MARK' && step === 'DASHBOARD') {
      const fetchDailyRecord = async () => {
        // Fetch records
        const records = await db.getAttendance(selBranchId, selBatchId, selSubjectId, attendanceDate);
        const statusMap: Record<string, boolean> = {};
        students.forEach(s => statusMap[s.uid] = true);
        if (selectedSlots.length > 0) {
           const primarySlot = selectedSlots[0];
           const currentSlotRecords = records.filter(r => (r.lectureSlot || 1) === primarySlot);
           currentSlotRecords.forEach(r => statusMap[r.studentId] = r.isPresent);
        }
        setAttendanceStatus(statusMap);
      };
      fetchDailyRecord();
    }
  }, [mode, attendanceDate, selectedSlots, students, selBranchId, selBatchId, selSubjectId]);

  // Load History
  useEffect(() => {
    if (mode === 'HISTORY' && step === 'DASHBOARD') {
      const fetchHistory = async () => {
        setLoadingHistory(true);
        const allRecords = await db.getAttendance(selBranchId, selBatchId, selSubjectId);
        setAllClassRecords(allRecords);
        
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
  const availableBranches = useMemo(() => {
    const ids = Array.from(new Set(assignments.map(a => a.branchId)));
    return ids.map(id => ({ id, name: metaData.branches[id] || 'Unknown Branch' }));
  }, [assignments, metaData]);

  const availableBatches = useMemo(() => {
    const relevant = assignments.filter(a => a.branchId === selBranchId);
    const hasAll = relevant.some(a => a.batchId === 'ALL');
    const ids = Array.from(new Set(relevant.map(a => a.batchId).filter(id => id !== 'ALL')));
    const options = ids.map(id => ({ id, name: metaData.batches[id] || 'Unknown Batch' }));
    
    if (hasAll) {
        options.unshift({ id: 'ALL', name: 'All Batches (Combined)' });
    }
    return options;
  }, [assignments, selBranchId, metaData]);

  const availableSubjects = useMemo(() => {
    const relevant = assignments.filter(a => 
        a.branchId === selBranchId && 
        (a.batchId === selBatchId || a.batchId === 'ALL')
    );
    return relevant.map(a => ({ 
      id: a.subjectId, 
      name: metaData.subjects[a.subjectId]?.name, 
      code: metaData.subjects[a.subjectId]?.code 
    }));
  }, [assignments, selBranchId, selBatchId, metaData]);

  const selectBranch = (id: string) => { setSelBranchId(id); setStep('BATCH'); };
  
  const selectBatch = (id: string) => {
    setSelBatchId(id);
    const relevantAssignments = assignments.filter(a => a.branchId === selBranchId && (a.batchId === id || a.batchId === 'ALL'));
    if (relevantAssignments.length === 1) {
      setSelSubjectId(relevantAssignments[0].subjectId);
      setStep('DASHBOARD');
      setMode('MENU');
    } else {
      setStep('SUBJECT');
    }
  };

  const selectSubject = (id: string) => { setSelSubjectId(id); setStep('DASHBOARD'); setMode('MENU'); };

  const goBack = () => {
    if (mode === 'HISTORY' && selectedStudent) { setSelectedStudent(null); return; }
    if (mode !== 'MENU') { setMode('MENU'); return; }
    
    if (step === 'DASHBOARD') {
        setStep('SUBJECT');
        setSelSubjectId('');
    } else if (step === 'SUBJECT') {
        setStep('BATCH');
        setSelBatchId('');
    } else if (step === 'BATCH') {
        setStep('BRANCH');
        setSelBranchId('');
    }
  };

  // --- Marking Handlers ---
  const handleToggleSlot = (num: number) => {
    setSelectedSlots(prev => prev.includes(num) ? (prev.length === 1 ? prev : prev.filter(n => n !== num)) : [...prev, num].sort((a,b) => a - b));
  };

  const handleSave = async () => {
    if (selectedSlots.length === 0) { alert("Select lecture slot."); return; }
    setMessage('Saving...');
    try {
      const allRecords: AttendanceRecord[] = [];
      selectedSlots.forEach(slot => {
         const slotRecords = students.map(s => ({
            id: `${attendanceDate}_${s.uid}_${selSubjectId}_L${slot}`,
            date: attendanceDate,
            studentId: s.uid,
            subjectId: selSubjectId,
            branchId: selBranchId,
            batchId: selBatchId,
            facultyId: user.uid,
            isPresent: attendanceStatus[s.uid],
            markedBy: user.uid,
            timestamp: Date.now(),
            lectureSlot: slot
         }));
         allRecords.push(...slotRecords);
      });
      await db.saveAttendance(allRecords);
      setMessage('✓ Saved');
      setTimeout(() => setMessage(''), 3000);
    } catch (e) { setMessage('Error'); setTimeout(() => setMessage(''), 3000); }
  };

  const toggleStatus = (uid: string) => setAttendanceStatus(prev => ({ ...prev, [uid]: !prev[uid] }));
  const markAll = (present: boolean) => { const newStatus = { ...attendanceStatus }; students.forEach(s => newStatus[s.uid] = present); setAttendanceStatus(newStatus); };
  
  const handleExportCSV = () => {
    if (allClassRecords.length === 0) { alert("No data"); return; }
    const headers = ["Date", "Lecture", "Student Name", "Roll No", "Status", "Marked By"];
    const rows = allClassRecords.map(r => {
      const s = students.find(stu => stu.uid === r.studentId);
      return [`"${r.date}"`, `"Lecture ${r.lectureSlot || 1}"`, `"${s?.displayName || 'Unknown'}"`, `"${s?.studentData?.rollNo || '-'}"`, r.isPresent ? 'Present' : 'Absent', `"${user.displayName}"`].join(",");
    });
    const link = document.createElement("a");
    link.href = encodeURI("data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n"));
    link.download = `Attendance_${metaData.subjects[selSubjectId]?.name}_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  const presentCount = Object.values(attendanceStatus).filter(Boolean).length;

  if (loadingAssignments) return <div className="p-12 text-center text-slate-500">Loading schedule...</div>;

  const renderBreadcrumb = () => (
    <div className="flex items-center text-sm text-slate-500 mb-6 bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex-wrap">
       {step !== 'BRANCH' && <button onClick={goBack} className="mr-3 p-1 hover:bg-slate-100 rounded-full"><ArrowLeft className="h-4 w-4" /></button>}
       <span className={step === 'BRANCH' ? 'font-bold text-indigo-700' : ''}>Branch</span>
       {selBranchId && <><ChevronRight className="h-4 w-4 mx-2" /><span className={step === 'BATCH' ? 'font-bold text-indigo-700' : ''}>{metaData.branches[selBranchId]}</span></>}
       {selBatchId && <><ChevronRight className="h-4 w-4 mx-2" /><span className={step === 'SUBJECT' ? 'font-bold text-indigo-700' : ''}>{selBatchId === 'ALL' ? 'All Batches' : metaData.batches[selBatchId]}</span></>}
       {selSubjectId && <><ChevronRight className="h-4 w-4 mx-2" /><span className="font-bold text-indigo-700">{metaData.subjects[selSubjectId]?.name}</span></>}
    </div>
  );

  // STEP 1: BRANCH
  if (step === 'BRANCH') {
    return (
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Select Branch</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {availableBranches.map(b => (
              <div key={b.id} onClick={() => selectBranch(b.id)} className="bg-white p-6 rounded-xl border hover:border-indigo-500 cursor-pointer shadow-sm group">
                <div className="bg-indigo-50 w-12 h-12 rounded-full flex items-center justify-center mb-4"><BookOpen className="h-6 w-6 text-indigo-600"/></div>
                <h3 className="font-bold text-lg text-slate-800">{b.name}</h3>
              </div>
            ))}
        </div>
      </div>
    );
  }

  // STEP 2: BATCH
  if (step === 'BATCH') {
    return (
      <div className="max-w-4xl mx-auto">
        {renderBreadcrumb()}
        <h2 className="text-xl font-bold text-slate-800 mb-4">Select Batch</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {availableBatches.map(b => (
            <div key={b.id} onClick={() => selectBatch(b.id)} className={`bg-white p-6 rounded-xl border hover:border-indigo-500 cursor-pointer shadow-sm group ${b.id === 'ALL' ? 'border-indigo-200 bg-indigo-50' : ''}`}>
              <div className="bg-teal-50 w-12 h-12 rounded-full flex items-center justify-center mb-4"><Users className="h-6 w-6 text-teal-600"/></div>
              <h3 className="font-bold text-lg text-slate-800">{b.name}</h3>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {availableSubjects.map(s => (
            <div key={s.id} onClick={() => selectSubject(s.id)} className="bg-white p-6 rounded-xl border hover:border-indigo-500 cursor-pointer shadow-sm group">
              <div className="bg-purple-50 w-12 h-12 rounded-full flex items-center justify-center mb-4"><BookOpen className="h-6 w-6 text-purple-600"/></div>
              <h3 className="font-bold text-lg text-slate-800">{s.name}</h3>
              <p className="text-sm font-mono text-slate-400 mt-1">{s.code}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // DASHBOARD
  if (step === 'DASHBOARD') {
       return (
      <div className="max-w-5xl mx-auto pb-24">
        {!selectedStudent ? renderBreadcrumb() : (
           <div className="flex items-center text-sm text-slate-500 mb-6 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
             <button onClick={goBack} className="mr-3 p-1 hover:bg-slate-100 rounded-full text-slate-700 flex items-center gap-1 font-medium"><ArrowLeft className="h-4 w-4" /> Back to List</button>
             <span className="text-slate-300 mx-2">|</span><span className="font-bold text-indigo-700">{selectedStudent.displayName}</span>
           </div>
        )}
        
        {mode === 'MENU' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div onClick={() => setMode('HISTORY')} className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 cursor-pointer transition-all flex flex-col items-center text-center group">
              <div className="h-20 w-20 bg-blue-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><BarChart3 className="h-10 w-10 text-blue-600" /></div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">View History</h3>
            </div>
            <div onClick={() => setMode('MARK')} className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 cursor-pointer transition-all flex flex-col items-center text-center group">
               <div className="h-20 w-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Clock className="h-10 w-10 text-emerald-600" /></div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Mark Attendance</h3>
            </div>
          </div>
        )}

        {mode === 'MARK' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
             <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <h3 className="font-bold text-lg flex items-center whitespace-nowrap"><Clock className="h-5 w-5 mr-2 text-indigo-600" /> Mark Attendance</h3>
                <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4 w-full lg:w-auto">
                   <div className="flex items-center gap-2">
                       <span className="text-sm text-slate-500 font-medium">Date:</span>
                       <input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} className="border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white"/>
                   </div>
                   <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                       <span className="text-sm text-slate-500 font-medium whitespace-nowrap">Lectures:</span>
                       <div className="flex gap-1 flex-wrap">
                        {[1, 2, 3, 4, 5, 6, 7].map(num => (
                            <button key={num} onClick={() => handleToggleSlot(num)} className={`w-8 h-8 rounded flex items-center justify-center text-sm font-bold border transition-colors ${selectedSlots.includes(num) ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'}`}>{num}</button>
                        ))}
                       </div>
                   </div>
                </div>
             </div>

             <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                {loadingStudents ? <div className="p-12 text-center text-slate-500">Loading list...</div> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200"><tr><th className="px-4 py-3 text-xs font-bold text-slate-900 uppercase w-24">Roll No</th><th className="px-4 py-3 text-xs font-bold text-slate-900 uppercase">Student Name</th><th className="px-4 py-3 text-xs font-bold text-slate-900 uppercase text-right w-32">Status</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {students.map(s => (
                          <tr key={s.uid} onClick={() => toggleStatus(s.uid)} className={`cursor-pointer transition-colors ${attendanceStatus[s.uid] ? 'hover:bg-slate-50' : 'bg-red-50/50 hover:bg-red-50'}`}>
                            <td className="px-4 py-3 font-mono text-sm text-slate-900">{s.studentData?.rollNo || s.studentData?.enrollmentId}</td>
                            <td className="px-4 py-3 text-sm font-medium text-slate-900">{s.displayName}</td>
                            <td className="px-4 py-3 text-right">
                              <div className={`relative inline-flex h-6 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${attendanceStatus[s.uid] ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${attendanceStatus[s.uid] ? 'translate-x-6' : 'translate-x-0'}`}>
                                  {attendanceStatus[s.uid] ? <Check className="h-3 w-3 text-indigo-600 m-1" /> : <X className="h-3 w-3 text-slate-400 m-1" />}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
             </div>
             
             {students.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-3 z-30">
                  <div className="container mx-auto max-w-5xl flex justify-between items-center">
                    <div className="text-sm font-medium hidden md:block"><span className="text-indigo-600 font-bold">{presentCount}</span> Present / <span className="text-slate-900 font-bold">{students.length}</span> Total</div>
                    <div className="flex gap-3 w-full md:w-auto justify-between md:justify-end">
                      <div className="flex bg-slate-100 rounded p-1">
                        <button onClick={() => markAll(true)} className="px-3 py-1.5 text-xs font-semibold hover:bg-white rounded transition">All Present</button>
                        <button onClick={() => markAll(false)} className="px-3 py-1.5 text-xs font-semibold hover:bg-white rounded transition">All Absent</button>
                      </div>
                      <Button onClick={handleSave} className="flex items-center space-x-2 px-6"><Save className="h-4 w-4" /><span>{message || (selectedSlots.length > 1 ? `Save (${selectedSlots.length} Lectures)` : 'Save Attendance')}</span></Button>
                    </div>
                  </div>
                </div>
             )}
          </div>
        )}

        {/* History Mode */}
        {mode === 'HISTORY' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
               {!selectedStudent ? (
                 <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    {/* Header */}
                    <div className="bg-white p-4 border-b flex justify-between items-center">
                       <h3 className="font-bold flex items-center"><History className="h-5 w-5 mr-2 text-blue-600"/> History</h3>
                       <Button variant="secondary" onClick={handleExportCSV} className="text-xs h-8">CSV</Button>
                    </div>
                    {/* Table */}
                    {loadingHistory ? <div className="p-8 text-center">Loading...</div> : (
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b"><tr><th className="p-3 text-slate-900">Roll</th><th className="p-3 text-slate-900">Name</th><th className="p-3 text-center text-slate-900">Total</th><th className="p-3 text-center text-slate-900">Present</th><th className="p-3 text-right text-slate-900">%</th></tr></thead>
                        <tbody className="divide-y">{historyStats.map(s => (
                           <tr key={s.uid} onClick={()=>setSelectedStudent(students.find(stu=>stu.uid===s.uid)||null)} className="hover:bg-slate-50 cursor-pointer">
                              <td className="p-3 font-mono text-slate-900">{s.roll}</td><td className="p-3 font-medium text-slate-900">{s.name}</td><td className="p-3 text-center text-slate-900">{s.total}</td><td className="p-3 text-center text-slate-900">{s.present}</td>
                              <td className="p-3 text-right"><span className={`px-2 py-0.5 rounded text-xs font-bold ${s.percent<75?'bg-red-100 text-red-700':'bg-green-100 text-green-700'}`}>{s.percent}%</span></td>
                           </tr>
                        ))}</tbody>
                      </table>
                    )}
                 </div>
               ) : (
                  // Detail View
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                      <h2 className="text-xl font-bold mb-4">{selectedStudent.displayName}</h2>
                      {/* Log Table */}
                      <table className="w-full text-sm text-left"><thead className="bg-slate-50 border-b"><tr><th className="p-2 text-slate-900">Date</th><th className="p-2 text-slate-900">Lec</th><th className="p-2 text-right text-slate-900">Status</th></tr></thead>
                        <tbody>{allClassRecords.filter(r=>r.studentId===selectedStudent.uid).sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).map(r=>(
                           <tr key={r.id} className="border-b"><td className="p-2 text-slate-900">{r.date}</td><td className="p-2 text-slate-900">L{r.lectureSlot}</td><td className="p-2 text-right"><span className={r.isPresent?'text-green-600':'text-red-600'}>{r.isPresent?'Present':'Absent'}</span></td></tr>
                        ))}</tbody>
                      </table>
                  </div>
               )}
            </div>
        )}
      </div>
    );
  }

  return null;
};
