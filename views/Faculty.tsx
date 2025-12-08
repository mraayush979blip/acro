
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../services/db';
import { User, FacultyAssignment, AttendanceRecord, Batch } from '../types';
import { Button, Card } from '../components/UI';
import { Save, History, FileDown, Filter, ArrowLeft, CheckCircle2, ChevronDown, Check, X, CheckSquare, Square, XCircle } from 'lucide-react';

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

  // Selection State (Top Bar)
  const [selBranchId, setSelBranchId] = useState('');
  const [selSubjectId, setSelSubjectId] = useState('');
  const [activeTab, setActiveTab] = useState<'MARK' | 'HISTORY'>('MARK');

  // Marking State
  const [allBranchStudents, setAllBranchStudents] = useState<User[]>([]); // Cache all students in branch
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSlots, setSelectedSlots] = useState<number[]>([1]);
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, boolean>>({});
  const [saveMessage, setSaveMessage] = useState('');
  const [allClassRecords, setAllClassRecords] = useState<AttendanceRecord[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Multi-Batch Selection State
  const [selectedMarkingBatches, setSelectedMarkingBatches] = useState<string[]>([]);
  const [isBatchDropdownOpen, setIsBatchDropdownOpen] = useState(false);

  // History State
  const [viewHistoryStudent, setViewHistoryStudent] = useState<User | null>(null);
  const [historyFilterDate, setHistoryFilterDate] = useState('');

  // 1. Initialize Data
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

  // 2. Load Branch Students & Attendance Data
  useEffect(() => {
    if (selBranchId && selSubjectId) {
      const load = async () => {
        // Fetch ALL students for the branch, we filter in UI based on selectedMarkingBatches
        const data = await db.getStudents(selBranchId);
        
        // Deduplicate
        const unique = Array.from(new Map(data.map(s => [s.uid, s])).values());
        // Sort numerically by Roll No
        setAllBranchStudents(unique.sort((a,b) => (a.studentData?.rollNo || '').localeCompare(b.studentData?.rollNo || '', undefined, { numeric: true })));
        
        // Load Attendance
        // For 'ALL' batches context, we fetch everything for this subject/branch
        setAllClassRecords(await db.getAttendance(selBranchId, 'ALL', selSubjectId));
      };
      load();
    }
  }, [selBranchId, selSubjectId]);

  // 3. Initialize Batch Selection when Subject/Branch changes
  useEffect(() => {
    if (selBranchId && selSubjectId) {
       // Find all relevant batches for this subject assignment
       // Logic: If assigned 'ALL' -> Select all batches in branch.
       // If assigned specific -> Select specific.
       const rel = assignments.filter(a => a.branchId === selBranchId && a.subjectId === selSubjectId);
       let batchesToSelect: string[] = [];
       
       if (rel.some(a => a.batchId === 'ALL')) {
           batchesToSelect = metaData.rawBatches.filter(b => b.branchId === selBranchId).map(b => b.id);
       } else {
           batchesToSelect = Array.from(new Set(rel.map(a => a.batchId)));
       }
       setSelectedMarkingBatches(batchesToSelect);
    }
  }, [selBranchId, selSubjectId, assignments, metaData.rawBatches]);

  // 4. Initialize Status for new filtered list
  useEffect(() => {
     const initialStatus: Record<string, boolean> = {};
     // Only initialize for visible students
     const visible = allBranchStudents.filter(s => s.studentData?.batchId && selectedMarkingBatches.includes(s.studentData.batchId));
     visible.forEach(s => initialStatus[s.uid] = true);
     setAttendanceStatus(prev => ({...initialStatus, ...prev})); // Merge to keep existing toggles
  }, [selectedMarkingBatches, allBranchStudents]);


  // --- Selection Logic ---
  const availableBranches = useMemo(() => {
    const ids = Array.from(new Set(assignments.map(a => a.branchId)));
    return ids.map(id => ({ id, name: metaData.branches[id] || id }));
  }, [assignments, metaData.branches]);

  const availableSubjects = useMemo(() => {
    if (!selBranchId) return [];
    // Show all subjects assigned to this faculty in this branch
    const rel = assignments.filter(a => a.branchId === selBranchId);
    const uniqueIds = Array.from(new Set(rel.map(a => a.subjectId)));
    return uniqueIds.map(sid => ({ id: sid, ...metaData.subjects[sid] }));
  }, [selBranchId, assignments, metaData.subjects]);

  // "Batches" Options for Multi-Select in Toolbar
  const sameSubjectBatches = useMemo(() => {
    if (!selBranchId || !selSubjectId) return [];
    
    const rel = assignments.filter(a => a.branchId === selBranchId && a.subjectId === selSubjectId);
    // If we have an 'ALL' assignment, allow selecting from ALL batches in branch
    if (rel.some(a => a.batchId === 'ALL')) return metaData.rawBatches.filter(b => b.branchId === selBranchId);

    const bids = Array.from(new Set(rel.map(a => a.batchId)));
    return bids.map(bid => ({ id: bid, name: metaData.batches[bid] || bid }));
  }, [assignments, selBranchId, selSubjectId, metaData.batches, metaData.rawBatches]);

  // Derived Students List (Visual)
  const visibleStudents = useMemo(() => {
     return allBranchStudents.filter(s => s.studentData?.batchId && selectedMarkingBatches.includes(s.studentData.batchId));
  }, [allBranchStudents, selectedMarkingBatches]);


  // --- Handlers ---
  const handleMark = (uid: string) => {
    setAttendanceStatus(prev => ({ ...prev, [uid]: !prev[uid] }));
  };

  const handleMarkAll = (status: boolean) => {
    const newStatus: Record<string, boolean> = {};
    visibleStudents.forEach(s => newStatus[s.uid] = status);
    setAttendanceStatus(prev => ({ ...prev, ...newStatus }));
  };

  const toggleSlot = (slot: number) => {
      setSelectedSlots(prev => prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot].sort());
  };

  const toggleBatchSelection = (batchId: string) => {
      setSelectedMarkingBatches(prev => {
          if (prev.includes(batchId)) return prev.filter(id => id !== batchId);
          return [...prev, batchId];
      });
  };

  const handleSave = async () => {
    if (selectedSlots.length === 0) { alert("Please select at least one lecture slot."); return; }
    if (visibleStudents.length === 0) { alert("No students selected."); return; }
    
    setIsSaving(true);
    setSaveMessage('');
    
    const records: AttendanceRecord[] = [];
    const timestamp = Date.now();

    selectedSlots.forEach(slot => {
        visibleStudents.forEach(s => {
            records.push({
                // ID construction ensures overwrite for same date/student/subject/slot
                id: `${attendanceDate}_${s.uid}_${selSubjectId}_L${slot}`,
                date: attendanceDate,
                studentId: s.uid,
                subjectId: selSubjectId,
                branchId: selBranchId,
                batchId: s.studentData!.batchId!, // Use student's actual batch
                isPresent: attendanceStatus[s.uid] ?? true,
                markedBy: user.displayName,
                timestamp: timestamp,
                lectureSlot: slot
            });
        });
    });

    try {
        await db.saveAttendance(records);
        setSaveMessage('Attendance Saved Successfully!');
        // Refresh History
        setAllClassRecords(await db.getAttendance(selBranchId, 'ALL', selSubjectId));
        setTimeout(() => setSaveMessage(''), 3000);
    } catch (e: any) {
        alert("Error saving: " + e.message);
    } finally {
        setIsSaving(false);
    }
  };

  const handleExportCSV = () => {
     if (allClassRecords.length === 0) return;
     // Filter records based on view (if date selected)
     let recordsToExport = allClassRecords;
     if (historyFilterDate) {
         recordsToExport = allClassRecords.filter(r => r.date === historyFilterDate);
     }

     const sorted = [...recordsToExport].sort((a,b) => b.timestamp - a.timestamp);
     
     const csvRows = [
        ['Date', 'Lecture Slot', 'Student Name', 'Enrollment', 'Batch', 'Status', 'Marked By'],
        ...sorted.map(r => {
           const stu = allBranchStudents.find(s => s.uid === r.studentId);
           return [
             `="${r.date}"`,
             r.lectureSlot || 1,
             `"${stu?.displayName || 'Unknown'}"`,
             `"${stu?.studentData?.enrollmentId || ''}"`,
             `"${metaData.batches[r.batchId] || r.batchId}"`,
             r.isPresent ? 'Present' : 'Absent',
             `"${user.displayName}"`
           ];
        })
     ];
     
     const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
     const encodedUri = encodeURI(csvContent);
     const link = document.createElement("a");
     link.setAttribute("href", encodedUri);
     link.setAttribute("download", `Attendance_${metaData.subjects[selSubjectId]?.name || 'Log'}${historyFilterDate ? '_'+historyFilterDate : ''}.csv`);
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

  const showDashboard = selBranchId && selSubjectId;

  return (
    <div className="space-y-6 pb-20"> 
      {/* 1. Command Center / Top Bar */}
      <Card className="bg-indigo-900 text-white border-none shadow-lg">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
               <label className="block text-xs text-indigo-200 mb-1 uppercase font-semibold">Branch</label>
               <select 
                 value={selBranchId} 
                 onChange={e => { setSelBranchId(e.target.value); setSelSubjectId(''); }}
                 className="w-full bg-indigo-800 border-indigo-700 text-white rounded p-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
               >
                 <option value="">Select Branch</option>
                 {availableBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
               </select>
            </div>
            {/* Removed Batch Context Dropdown from Top Bar */}
            <div>
               <label className="block text-xs text-indigo-200 mb-1 uppercase font-semibold">Subject</label>
               <select 
                 value={selSubjectId} 
                 onChange={e => setSelSubjectId(e.target.value)}
                 disabled={!selBranchId}
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
            <h3 className="text-lg font-medium text-slate-600">Select Branch & Subject</h3>
            <p className="text-slate-400">Choose Branch and Subject to start marking attendance.</p>
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
                     <div className="flex flex-col gap-4 flex-grow">
                        <div className="flex gap-4">
                           <div className="w-48">
                              <label className="block text-xs font-semibold text-slate-500 mb-1">Date</label>
                              <input 
                                 type="date" 
                                 value={attendanceDate}
                                 onChange={e => setAttendanceDate(e.target.value)}
                                 className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                              />
                           </div>
                           
                           {/* Multi Batch Selector */}
                           <div className="w-64 relative">
                              <label className="block text-xs font-semibold text-slate-500 mb-1">Batches</label>
                              <button 
                                 onClick={() => setIsBatchDropdownOpen(!isBatchDropdownOpen)}
                                 className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900 flex justify-between items-center focus:ring-2 focus:ring-indigo-500"
                              >
                                 <span className="truncate">{selectedMarkingBatches.length > 0 ? `${selectedMarkingBatches.length} Selected` : 'Select Batches'}</span>
                                 <ChevronDown className="h-4 w-4 text-slate-400" />
                              </button>
                              
                              {isBatchDropdownOpen && (
                                 <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 shadow-lg rounded-md z-10 max-h-60 overflow-y-auto">
                                    {sameSubjectBatches.map(b => {
                                        const isSelected = selectedMarkingBatches.includes(b.id);
                                        return (
                                           <div 
                                              key={b.id} 
                                              onClick={() => toggleBatchSelection(b.id)}
                                              className="px-3 py-2 hover:bg-indigo-50 cursor-pointer flex items-center text-sm"
                                           >
                                              {isSelected ? <CheckSquare className="h-4 w-4 text-indigo-600 mr-2" /> : <Square className="h-4 w-4 text-slate-300 mr-2" />}
                                              <span className={isSelected ? 'text-indigo-900 font-medium' : 'text-slate-600'}>{b.name}</span>
                                           </div>
                                        );
                                    })}
                                    {sameSubjectBatches.length === 0 && <div className="p-2 text-xs text-slate-400 text-center">No batches found</div>}
                                 </div>
                              )}
                              {isBatchDropdownOpen && (
                                 <div className="fixed inset-0 z-0" onClick={() => setIsBatchDropdownOpen(false)}></div>
                              )}
                           </div>
                        </div>

                        <div>
                           <label className="block text-xs font-semibold text-slate-500 mb-1">Lecture Slots</label>
                           <div className="flex gap-1 flex-wrap">
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
                              <th className="py-3 px-4 text-xs font-bold text-slate-900 uppercase tracking-wider w-20">Roll</th>
                              <th className="py-3 px-4 text-xs font-bold text-slate-900 uppercase tracking-wider">Student Details</th>
                              {/* Removed Batch Column as requested */}
                              <th className="py-3 px-4 text-xs font-bold text-slate-900 uppercase tracking-wider text-center w-32">Status</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {visibleStudents.map((s) => (
                              <tr key={s.uid} className={`hover:bg-slate-50 transition-colors ${!attendanceStatus[s.uid] ? 'bg-red-50/30' : ''}`}>
                                 <td className="py-3 px-4 text-slate-900 font-mono text-sm">{s.studentData?.rollNo || '-'}</td>
                                 <td className="py-3 px-4">
                                    <div className="font-semibold text-slate-900">{s.displayName}</div>
                                    <div className="text-xs text-slate-500 font-mono">{s.studentData?.enrollmentId}</div>
                                 </td>
                                 <td className="py-3 px-4 text-center">
                                    <div className="flex justify-center">
                                       <ToggleSwitch 
                                          checked={attendanceStatus[s.uid] ?? true} 
                                          onChange={() => handleMark(s.uid)} 
                                       />
                                    </div>
                                 </td>
                              </tr>
                           ))}
                           {visibleStudents.length === 0 && (
                              <tr><td colSpan={3} className="p-8 text-center text-slate-400">No students found in selected batches.</td></tr>
                           )}
                        </tbody>
                     </table>
                  </div>

                  {/* Sticky Footer */}
                  <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-indigo-100 p-4 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] z-40 flex justify-between items-center md:pl-8 md:pr-8">
                     <div className="text-sm font-medium text-slate-600 hidden sm:block">
                        Marking: <span className="text-indigo-600 font-bold">{visibleStudents.filter(s => attendanceStatus[s.uid]).length}</span> Present / <span className="text-slate-900">{visibleStudents.length}</span> Total
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
                  <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center mb-6 gap-4">
                     <h3 className="font-bold text-lg text-slate-800">Class Attendance Log</h3>
                     <div className="flex gap-3 items-center">
                         <div className="flex items-center gap-2">
                             <label className="text-xs font-semibold text-slate-500">Filter Date:</label>
                             <input 
                                type="date" 
                                value={historyFilterDate}
                                onChange={e => setHistoryFilterDate(e.target.value)}
                                className="px-2 py-1.5 text-sm bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                             />
                             {historyFilterDate && <button onClick={() => setHistoryFilterDate('')} className="text-slate-400 hover:text-slate-600"><XCircle className="h-4 w-4"/></button>}
                         </div>
                         <Button variant="secondary" onClick={handleExportCSV} disabled={allClassRecords.length === 0}>
                            <FileDown className="h-4 w-4 mr-2" /> Export CSV
                         </Button>
                     </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                     <table className="w-full text-sm text-left text-slate-900">
                        <thead className="bg-slate-50 border-b">
                           <tr>
                              <th className="p-3 text-slate-900 font-bold">Roll</th>
                              <th className="p-3 text-slate-900 font-bold">Name</th>
                              {historyFilterDate ? (
                                  <>
                                    <th className="p-3 text-slate-900 font-bold text-center">Batch</th>
                                    <th className="p-3 text-slate-900 font-bold text-center">Date Status ({historyFilterDate})</th>
                                  </>
                              ) : (
                                  <>
                                    <th className="p-3 text-slate-900 font-bold text-center">Total Sessions</th>
                                    <th className="p-3 text-slate-900 font-bold text-center">Present</th>
                                    <th className="p-3 text-slate-900 font-bold text-center">%</th>
                                    <th className="p-3 text-slate-900 font-bold text-right">Action</th>
                                  </>
                              )}
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {visibleStudents.map(s => {
                              // Filter records for student
                              const myRecs = allClassRecords.filter(r => r.studentId === s.uid);
                              
                              if (historyFilterDate) {
                                  // DATE VIEW
                                  const dateRecs = myRecs.filter(r => r.date === historyFilterDate);
                                  const slotsTaken = dateRecs.map(r => r.lectureSlot).sort();
                                  
                                  return (
                                     <tr key={s.uid} className="hover:bg-indigo-50 transition-colors">
                                        <td className="p-3 font-mono text-slate-600">{s.studentData?.rollNo}</td>
                                        <td className="p-3 font-medium text-slate-900">{s.displayName}</td>
                                        <td className="p-3 text-center text-slate-500">{metaData.batches[s.studentData?.batchId || ''] || s.studentData?.batchId}</td>
                                        <td className="p-3 text-center">
                                            {dateRecs.length > 0 ? (
                                                <div className="flex gap-2 justify-center flex-wrap">
                                                    {dateRecs.map(r => (
                                                        <span key={r.id} className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold border ${r.isPresent ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                                            L{r.lectureSlot || 1}: {r.isPresent ? 'P' : 'A'}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 italic">No Data</span>
                                            )}
                                        </td>
                                     </tr>
                                  )
                              } else {
                                  // AGGREGATE VIEW
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
                              }
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