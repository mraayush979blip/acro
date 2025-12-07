
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../services/db';
import { User, FacultyAssignment, AttendanceRecord, Batch } from '../types';
import { Button, Select, Card, Modal } from '../components/UI';
import { Save, Clock, History, FileDown, Filter, ArrowLeft, Calendar, XCircle, CheckCircle2, ChevronDown, Check, X } from 'lucide-react';

interface FacultyProps { user: User; }

// Modern Toggle Switch Component
const ToggleSwitch: React.FC<{ checked: boolean; onChange: () => void; disabled?: boolean }> = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    onClick={onChange}
    disabled={disabled}
    className={`w-14 h-7 rounded-full p-1 transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
      checked ? 'bg-green-500' : 'bg-slate-200'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <div
      className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ease-in-out flex items-center justify-center ${
        checked ? 'translate-x-7' : 'translate-x-0'
      }`}
    >
        {checked ? <Check className="w-3 h-3 text-green-600" /> : <X className="w-3 h-3 text-slate-400" />}
    </div>
  </button>
);

export const FacultyDashboard: React.FC<FacultyProps> = ({ user }) => {
  const [assignments, setAssignments] = useState<FacultyAssignment[]>([]);
  const [metaData, setMetaData] = useState<{
    branches: Record<string, string>;
    batches: Record<string, string>;
    subjects: Record<string, {name: string, code: string}>;
    rawBatches: Batch[];
  }>({ branches: {}, batches: {}, subjects: {}, rawBatches: [] });
  const [loadingInit, setLoadingInit] = useState(true);

  // Selection State
  const [selBranchId, setSelBranchId] = useState('');
  const [selBatchId, setSelBatchId] = useState('');
  const [selSubjectId, setSelSubjectId] = useState('');
  const [activeTab, setActiveTab] = useState<'MARK' | 'HISTORY'>('MARK');

  const [students, setStudents] = useState<User[]>([]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSlots, setSelectedSlots] = useState<number[]>([1]);
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, boolean>>({});
  const [saveMessage, setSaveMessage] = useState('');
  const [allClassRecords, setAllClassRecords] = useState<AttendanceRecord[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Detailed History View State
  const [viewHistoryStudent, setViewHistoryStudent] = useState<User | null>(null);

  useEffect(() => {
    const init = async () => {
      const myAssignments = await db.getAssignments(user.uid);
      const [allBranches, allSubjects] = await Promise.all([db.getBranches(), db.getSubjects()]);
      
      const branchMap: Record<string, string> = {};
      allBranches.forEach(b => branchMap[b.id] = b.name);
      const subjectMap: Record<string, {name: string, code: string}> = {};
      allSubjects.forEach(s => subjectMap[s.id] = { name: s.name, code: s.code });
      
      // Fetch Batches for involved branches
      const branchIds = Array.from(new Set(myAssignments.map(a => a.branchId)));
      const batchMap: Record<string, string> = {};
      const allBatches: Batch[] = [];

      for (const bid of branchIds) {
          const bts = await db.getBatches(bid);
          bts.forEach(b => { batchMap[b.id] = b.name; allBatches.push(b); });
      }

      setMetaData({ branches: branchMap, batches: batchMap, subjects: subjectMap, rawBatches: allBatches });
      setAssignments(myAssignments);
      setLoadingInit(false);
    };
    init();
  }, [user.uid]);

  // Load Students & History
  useEffect(() => {
    if (selBranchId && selBatchId && selSubjectId) {
      const load = async () => {
        const data = await db.getStudents(selBranchId, selBatchId);
        // Deduplicate
        const unique = Array.from(new Map(data.map(s => [s.uid, s])).values());
        setStudents(unique.sort((a,b) => (a.studentData?.rollNo || '').localeCompare(b.studentData?.rollNo || '')));
        setAllClassRecords(await db.getAttendance(selBranchId, selBatchId, selSubjectId));
        
        // Reset status
        const initialStatus: Record<string, boolean> = {};
        unique.forEach(s => initialStatus[s.uid] = true); // Default Present
        setAttendanceStatus(initialStatus);
      };
      load();
    }
  }, [selBranchId, selBatchId, selSubjectId]);

  // Derived Selection Options
  const availableBranches = useMemo(() => {
    const ids = Array.from(new Set(assignments.map(a => a.branchId)));
    return ids.map(id => ({ id, name: metaData.branches[id] || id }));
  }, [assignments, metaData.branches]);

  const availableBatches = useMemo(() => {
    if (!selBranchId) return [];
    // Filter assignments for this branch
    const relAssignments = assignments.filter(a => a.branchId === selBranchId);
    // Get unique batch IDs from assignments. 
    // If 'ALL' is present, we must look up all batches for this branch from rawBatches.
    const hasAll = relAssignments.some(a => a.batchId === 'ALL');
    
    if (hasAll) {
       return metaData.rawBatches.filter(b => b.branchId === selBranchId);
    }
    
    const batchIds = Array.from(new Set(relAssignments.map(a => a.batchId)));
    return batchIds.map(id => ({ id, name: metaData.batches[id] || id }));
  }, [selBranchId, assignments, metaData.batches, metaData.rawBatches]);

  const availableSubjects = useMemo(() => {
    if (!selBranchId || !selBatchId) return [];
    // Logic: Assignments matching Branch AND (Batch OR 'ALL')
    const relevant = assignments.filter(a => 
       a.branchId === selBranchId && 
       (a.batchId === selBatchId || a.batchId === 'ALL')
    );
    const uniqueIds = Array.from(new Set(relevant.map(a => a.subjectId)));
    return uniqueIds.map(sid => ({ id: sid, ...metaData.subjects[sid] }));
  }, [selBranchId, selBatchId, assignments, metaData.subjects]);

  // Handlers
  const handleMark = (uid: string) => {
    setAttendanceStatus(prev => ({ ...prev, [uid]: !prev[uid] }));
  };

  const handleMarkAll = (status: boolean) => {
    const newStatus: Record<string, boolean> = {};
    students.forEach(s => newStatus[s.uid] = status);
    setAttendanceStatus(newStatus);
  };

  const toggleSlot = (slot: number) => {
      setSelectedSlots(prev => prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot].sort());
  };

  const handleSave = async () => {
    if (selectedSlots.length === 0) { alert("Please select at least one lecture slot."); return; }
    setIsSaving(true);
    setSaveMessage('');
    
    const records: AttendanceRecord[] = [];
    const timestamp = Date.now();

    selectedSlots.forEach(slot => {
        students.forEach(s => {
            records.push({
                id: `${attendanceDate}_${s.uid}_${selSubjectId}_L${slot}`,
                date: attendanceDate,
                studentId: s.uid,
                subjectId: selSubjectId,
                branchId: selBranchId,
                batchId: selBatchId,
                isPresent: attendanceStatus[s.uid],
                markedBy: user.displayName, // Use Name
                timestamp: timestamp,
                lectureSlot: slot
            });
        });
    });

    try {
        await db.saveAttendance(records);
        setSaveMessage('Attendance Saved Successfully!');
        // Refresh History
        setAllClassRecords(await db.getAttendance(selBranchId, selBatchId, selSubjectId));
        setTimeout(() => setSaveMessage(''), 3000);
    } catch (e: any) {
        alert("Error saving: " + e.message);
    } finally {
        setIsSaving(false);
    }
  };

  const handleExportCSV = () => {
     if (allClassRecords.length === 0) return;
     const sorted = [...allClassRecords].sort((a,b) => b.timestamp - a.timestamp);
     
     const csvRows = [
        ['Date', 'Lecture Slot', 'Student Name', 'Enrollment', 'Status', 'Marked By'],
        ...sorted.map(r => {
           const stu = students.find(s => s.uid === r.studentId);
           return [
             `="${r.date}"`, // Force Excel string format
             r.lectureSlot || 1,
             `"${stu?.displayName || 'Unknown'}"`,
             `"${stu?.studentData?.enrollmentId || ''}"`,
             r.isPresent ? 'Present' : 'Absent',
             `"${user.displayName}"`
           ];
        })
     ];
     
     const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
     const encodedUri = encodeURI(csvContent);
     const link = document.createElement("a");
     link.setAttribute("href", encodedUri);
     link.setAttribute("download", `Attendance_${metaData.subjects[selSubjectId]?.name || 'Log'}_${attendanceDate}.csv`);
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
  };

  // --- Render Helpers ---

  // Drill Down View
  if (viewHistoryStudent) {
     const studentRecords = allClassRecords.filter(r => r.studentId === viewHistoryStudent.uid).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
     const total = studentRecords.length;
     const present = studentRecords.filter(r => r.isPresent).length;
     const pct = total === 0 ? 0 : Math.round((present/total)*100);

     return (
        <Card>
           <div className="flex items-center gap-4 mb-6">
              <button onClick={() => setViewHistoryStudent(null)} className="p-2 hover:bg-slate-100 rounded-full"><ArrowLeft /></button>
              <div>
                 <h3 className="text-xl font-bold text-slate-900">{viewHistoryStudent.displayName}</h3>
                 <div className="flex gap-4 text-sm text-slate-500 mt-1">
                    <span>Attendance: <strong className={pct < 75 ? 'text-red-600' : 'text-green-600'}>{pct}%</strong></span>
                    <span>({present}/{total})</span>
                 </div>
              </div>
           </div>
           
           <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {studentRecords.map(r => (
                 <div key={r.id} className={`p-3 rounded-lg border text-center ${r.isPresent ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="text-xs font-semibold text-slate-500 mb-1">{r.date}</div>
                    <div className={`text-lg font-bold ${r.isPresent ? 'text-green-700' : 'text-red-700'}`}>
                       {r.isPresent ? 'P' : 'A'}
                    </div>
                    <div className="text-[10px] text-slate-400">L{r.lectureSlot || 1}</div>
                 </div>
              ))}
           </div>
        </Card>
     );
  }

  if (loadingInit) return <div className="p-8 text-center">Loading Dashboard...</div>;

  const showDashboard = selBranchId && selBatchId && selSubjectId;

  return (
    <div className="space-y-6 pb-20"> {/* pb-20 for sticky footer space */}
      
      {/* 1. Command Center / Top Bar */}
      <Card className="bg-indigo-900 text-white border-none shadow-lg">
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
               <label className="block text-xs text-indigo-200 mb-1 uppercase font-semibold">Branch</label>
               <select 
                 value={selBranchId} 
                 onChange={e => { setSelBranchId(e.target.value); setSelBatchId(''); setSelSubjectId(''); }}
                 className="w-full bg-indigo-800 border-indigo-700 text-white rounded p-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
               >
                 <option value="">Select Branch</option>
                 {availableBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
               </select>
            </div>
            <div>
               <label className="block text-xs text-indigo-200 mb-1 uppercase font-semibold">Batch</label>
               <select 
                 value={selBatchId} 
                 onChange={e => { setSelBatchId(e.target.value); setSelSubjectId(''); }}
                 disabled={!selBranchId}
                 className="w-full bg-indigo-800 border-indigo-700 text-white rounded p-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none disabled:opacity-50"
               >
                 <option value="">Select Batch</option>
                 {availableBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
               </select>
            </div>
            <div>
               <label className="block text-xs text-indigo-200 mb-1 uppercase font-semibold">Subject</label>
               <select 
                 value={selSubjectId} 
                 onChange={e => setSelSubjectId(e.target.value)}
                 disabled={!selBatchId}
                 className="w-full bg-indigo-800 border-indigo-700 text-white rounded p-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none disabled:opacity-50"
               >
                 <option value="">Select Subject</option>
                 {availableSubjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
               </select>
            </div>
         </div>
      </Card>

      {!showDashboard ? (
         <div className="text-center py-20 bg-white rounded-lg border border-dashed border-slate-300">
            <Filter className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-600">Select a Class Context</h3>
            <p className="text-slate-400">Choose Branch, Batch, and Subject to manage attendance.</p>
         </div>
      ) : (
         <>
            {/* 2. Tabs */}
            <div className="flex border-b border-slate-200">
               <button 
                 onClick={() => setActiveTab('MARK')}
                 className={`px-6 py-3 font-medium text-sm transition-colors flex items-center ${activeTab === 'MARK' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 <CheckCircle2 className="w-4 h-4 mr-2" /> Mark Attendance
               </button>
               <button 
                 onClick={() => setActiveTab('HISTORY')}
                 className={`px-6 py-3 font-medium text-sm transition-colors flex items-center ${activeTab === 'HISTORY' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 <History className="w-4 h-4 mr-2" /> View History
               </button>
            </div>

            {activeTab === 'MARK' && (
               <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                     <div className="flex flex-col md:flex-row gap-4">
                        <div className="w-full md:w-auto">
                           <label className="block text-xs font-semibold text-slate-500 mb-1">Date</label>
                           <input 
                              type="date" 
                              value={attendanceDate}
                              onChange={e => setAttendanceDate(e.target.value)}
                              className="px-3 py-2 bg-white border border-slate-300 rounded text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                           />
                        </div>
                        <div>
                           <label className="block text-xs font-semibold text-slate-500 mb-1">Lecture Slots</label>
                           <div className="flex gap-1">
                              {[1, 2, 3, 4, 5, 6, 7].map(slot => (
                                 <button
                                    key={slot}
                                    onClick={() => toggleSlot(slot)}
                                    className={`w-8 h-9 rounded text-sm font-medium transition-colors ${selectedSlots.includes(slot) ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                 >
                                    {slot}
                                 </button>
                              ))}
                           </div>
                        </div>
                     </div>
                     <div className="flex gap-2">
                        <button onClick={() => handleMarkAll(true)} className="text-xs px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded border border-green-200">All Present</button>
                        <button onClick={() => handleMarkAll(false)} className="text-xs px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded border border-red-200">All Absent</button>
                     </div>
                  </div>

                  {/* Student List Table */}
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                     <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200">
                           <tr>
                              <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-16">Roll</th>
                              <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Student Details</th>
                              <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-32">Status</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {students.map((s) => (
                              <tr key={s.uid} className={`hover:bg-slate-50 transition-colors ${!attendanceStatus[s.uid] ? 'bg-red-50/30' : ''}`}>
                                 <td className="py-3 px-4 text-slate-500 font-mono text-sm">{s.studentData?.rollNo || '-'}</td>
                                 <td className="py-3 px-4">
                                    <div className="font-semibold text-slate-900">{s.displayName}</div>
                                    <div className="text-xs text-slate-500 font-mono">{s.studentData?.enrollmentId}</div>
                                 </td>
                                 <td className="py-3 px-4 text-center">
                                    <div className="flex justify-center">
                                       <ToggleSwitch 
                                          checked={attendanceStatus[s.uid]} 
                                          onChange={() => handleMark(s.uid)} 
                                       />
                                    </div>
                                 </td>
                              </tr>
                           ))}
                           {students.length === 0 && (
                              <tr><td colSpan={3} className="p-8 text-center text-slate-400">No students found in this batch.</td></tr>
                           )}
                        </tbody>
                     </table>
                  </div>

                  {/* Sticky Footer Action Bar */}
                  <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-indigo-100 p-4 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] z-40 flex justify-between items-center md:pl-8 md:pr-8">
                     <div className="text-sm font-medium text-slate-600 hidden sm:block">
                        Marking: <span className="text-indigo-600 font-bold">{students.filter(s => attendanceStatus[s.uid]).length}</span> Present / <span className="text-slate-900">{students.length}</span> Total
                     </div>
                     <div className="flex items-center gap-4 ml-auto">
                        {saveMessage && <span className="text-green-600 text-sm font-medium animate-pulse">{saveMessage}</span>}
                        <Button onClick={handleSave} disabled={isSaving} className="shadow-lg shadow-indigo-200">
                           {isSaving ? 'Saving...' : `Save Attendance (${selectedSlots.length} Slots)`}
                        </Button>
                     </div>
                  </div>
               </div>
            )}

            {activeTab === 'HISTORY' && (
               <Card>
                  <div className="flex justify-between items-center mb-6">
                     <h3 className="font-bold text-lg text-slate-800">Class Attendance Log</h3>
                     <Button variant="secondary" onClick={handleExportCSV} disabled={allClassRecords.length === 0}>
                        <FileDown className="h-4 w-4 mr-2" /> Export CSV
                     </Button>
                  </div>
                  
                  <div className="overflow-x-auto">
                     <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 border-b">
                           <tr>
                              <th className="p-3 text-slate-900 font-bold">Roll</th>
                              <th className="p-3 text-slate-900 font-bold">Name</th>
                              <th className="p-3 text-slate-900 font-bold text-center">Total Sessions</th>
                              <th className="p-3 text-slate-900 font-bold text-center">Present</th>
                              <th className="p-3 text-slate-900 font-bold text-center">%</th>
                              <th className="p-3 text-slate-900 font-bold text-right">Action</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {students.map(s => {
                              const myRecs = allClassRecords.filter(r => r.studentId === s.uid);
                              const total = myRecs.length;
                              const present = myRecs.filter(r => r.isPresent).length;
                              const pct = total === 0 ? 0 : Math.round((present/total)*100);
                              
                              return (
                                 <tr key={s.uid} onClick={() => setViewHistoryStudent(s)} className="hover:bg-indigo-50 cursor-pointer transition-colors group">
                                    <td className="p-3 font-mono text-slate-600">{s.studentData?.rollNo}</td>
                                    <td className="p-3 font-medium text-slate-900">{s.displayName}</td>
                                    <td className="p-3 text-center text-slate-600">{total}</td>
                                    <td className="p-3 text-center text-green-700 font-medium">{present}</td>
                                    <td className="p-3 text-center">
                                       <span className={`px-2 py-0.5 rounded text-xs font-bold ${pct < 75 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{pct}%</span>
                                    </td>
                                    <td className="p-3 text-right text-slate-400 group-hover:text-indigo-600">
                                       <ChevronDown className="h-4 w-4 inline transform -rotate-90" />
                                    </td>
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
    </div>
  );
};
