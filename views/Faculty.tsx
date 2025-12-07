
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../services/db';
import { User, FacultyAssignment, AttendanceRecord, Batch } from '../types';
import { Button, Select, Card, Modal } from '../components/UI';
import { Save, Clock, History, FileDown, Filter, ArrowLeft, Calendar, XCircle, CheckCircle2 } from 'lucide-react';

interface FacultyProps { user: User; }

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

  // Load Students
  useEffect(() => {
    if (selBranchId && selBatchId && selSubjectId) {
      const load = async () => {
        const data = await db.getStudents(selBranchId, selBatchId);
        // Deduplicate
        const unique = Array.from(new Map(data.map(s => [s.uid, s])).values());
        setStudents(unique.sort((a,b) => (a.studentData?.rollNo || '').localeCompare(b.studentData?.rollNo || '')));
        setAllClassRecords(await db.getAttendance(selBranchId, selBatchId, selSubjectId));
        setViewHistoryStudent(null); // Reset detail view when context changes
      };
      load();
    } else { setStudents([]); }
  }, [selBranchId, selBatchId, selSubjectId]);

  // Computed Options
  const availableBranches = useMemo(() => Array.from(new Set(assignments.map(a => a.branchId))).map(id => ({id, name: metaData.branches[id]||id})), [assignments, metaData]);
  
  const availableBatches = useMemo(() => {
      const rel = assignments.filter(a => a.branchId === selBranchId);
      return Array.from(new Set(rel.map(a => a.batchId))).filter(id => id !== 'ALL').map(id => ({id, name: metaData.batches[id]||id}));
  }, [assignments, selBranchId, metaData]);

  const availableSubjects = useMemo(() => {
      const rel = assignments.filter(a => a.branchId === selBranchId && a.batchId === selBatchId);
      const uniqueSubjectIds = Array.from(new Set(rel.map(a => a.subjectId)));
      return uniqueSubjectIds.map(id => ({id, name: metaData.subjects[id]?.name||id, code: metaData.subjects[id]?.code}));
  }, [assignments, selBranchId, selBatchId, metaData]);

  const handleSave = async () => {
     if(selectedSlots.length===0) { alert("Select slot"); return; }
     setSaveMessage("Saving...");
     const recs: AttendanceRecord[] = [];
     selectedSlots.forEach(slot => {
        students.forEach(s => {
           recs.push({
             id: `${attendanceDate}_${s.uid}_${selSubjectId}_L${slot}`, date: attendanceDate, studentId: s.uid, subjectId: selSubjectId, 
             branchId: selBranchId, batchId: selBatchId, isPresent: !!attendanceStatus[s.uid], markedBy: user.uid, timestamp: Date.now(), lectureSlot: slot
           });
        });
     });
     await db.saveAttendance(recs);
     setAllClassRecords(await db.getAttendance(selBranchId, selBatchId, selSubjectId)); // Refresh history
     setSaveMessage("Saved!");
     setTimeout(()=>setSaveMessage(''), 2000);
  };
  const markAll = (val: boolean) => { const n = {...attendanceStatus}; students.forEach(s=>n[s.uid]=val); setAttendanceStatus(n); };
  const toggleStatus = (uid: string) => setAttendanceStatus(p => ({...p, [uid]: !p[uid]}));

  const handleExportCSV = () => {
     if (allClassRecords.length === 0) return;
     const headers = ["Date", "Roll No", "Student Name", "Subject", "Slot", "Status", "Marked By"];
     const csvRows = [headers.join(',')];
     const sorted = [...allClassRecords].sort((a,b) => b.timestamp - a.timestamp);
     sorted.forEach(r => {
        const student = students.find(s => s.uid === r.studentId);
        const subject = metaData.subjects[r.subjectId];
        const row = [
           `"${r.date}"`,
           `"${student?.studentData?.rollNo || ''}"`,
           `"${student?.displayName || 'Unknown'}"`,
           `"${subject?.name || r.subjectId}"`,
           r.lectureSlot || 1,
           r.isPresent ? "Present" : "Absent",
           `"${user.displayName}"`
        ];
        csvRows.push(row.join(','));
     });
     const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
     const url = window.URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `Attendance_${selBranchId}_${selBatchId}_${attendanceDate}.csv`;
     a.click();
  };

  if (loadingInit) return <div>Loading...</div>;

  return (
    <div className="space-y-6 pb-20">
       <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row gap-4 sticky top-0 z-10">
          <select value={selBranchId} onChange={e=>{setSelBranchId(e.target.value); setSelBatchId('');}} className="p-2 border rounded text-slate-900 bg-white"><option value="">Branch</option>{availableBranches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <select value={selBatchId} onChange={e=>{setSelBatchId(e.target.value); setSelSubjectId('');}} disabled={!selBranchId} className="p-2 border rounded text-slate-900 bg-white"><option value="">Batch</option>{availableBatches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <select value={selSubjectId} onChange={e=>setSelSubjectId(e.target.value)} disabled={!selBatchId} className="p-2 border rounded text-slate-900 bg-white"><option value="">Subject</option>{availableSubjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
       </div>

       {!selSubjectId ? <div className="text-center p-10 bg-white border border-dashed text-slate-500">Select options above</div> : (
         <>
           {!viewHistoryStudent && (
             <div className="flex border-b">
                <button onClick={()=>setActiveTab('MARK')} className={`px-6 py-3 font-medium ${activeTab==='MARK'?'text-indigo-600 border-b-2 border-indigo-600':'text-slate-500'}`}>Mark Attendance</button>
                <button onClick={()=>setActiveTab('HISTORY')} className={`px-6 py-3 font-medium ${activeTab==='HISTORY'?'text-indigo-600 border-b-2 border-indigo-600':'text-slate-500'}`}>History</button>
             </div>
           )}
           
           {activeTab === 'MARK' && (
             <div>
                <div className="bg-white p-4 border rounded mb-4 flex justify-between items-center">
                   <div className="flex gap-4">
                      <input type="date" value={attendanceDate} onChange={e=>setAttendanceDate(e.target.value)} className="border p-1 rounded text-slate-900 bg-white" />
                      <div className="flex gap-1">{[1,2,3,4,5,6,7].map(n=><button key={n} onClick={()=>setSelectedSlots(p=>p.includes(n)?p.filter(x=>x!==n):[...p,n])} className={`w-8 h-8 border rounded ${selectedSlots.includes(n)?'bg-indigo-600 text-white':'bg-white text-slate-900'}`}>{n}</button>)}</div>
                   </div>
                   <div className="flex gap-2"><button onClick={()=>markAll(true)} className="px-3 py-1 bg-green-100 text-green-700 rounded">Present All</button><button onClick={()=>markAll(false)} className="px-3 py-1 bg-red-100 text-red-700 rounded">Absent All</button></div>
                </div>
                <div className="bg-white border rounded">
                   <table className="w-full text-left text-sm"><thead className="bg-slate-50 border-b"><tr><th className="p-3 text-slate-900">Roll</th><th className="p-3 text-slate-900">Name</th><th className="p-3 text-right text-slate-900">Status</th></tr></thead>
                   <tbody>{students.map(s=>(<tr key={s.uid} onClick={()=>toggleStatus(s.uid)} className="cursor-pointer border-b hover:bg-slate-50"><td className="p-3 font-mono text-slate-900">{s.studentData?.rollNo}</td><td className="p-3 text-slate-900">{s.displayName}</td><td className="p-3 text-right"><div className={`w-4 h-4 rounded-full inline-block ${attendanceStatus[s.uid]?'bg-indigo-600':'bg-slate-300'}`}></div></td></tr>))}</tbody></table>
                </div>
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-between container mx-auto"><span className="font-bold text-indigo-600">{Object.values(attendanceStatus).filter(Boolean).length} / {students.length}</span><Button onClick={handleSave}>{saveMessage||'Save'}</Button></div>
             </div>
           )}
           {activeTab === 'HISTORY' && (
              !viewHistoryStudent ? (
                <div className="bg-white border rounded p-4">
                   <div className="flex justify-between items-center mb-4"><h3 className="font-bold">Class History</h3><Button variant="secondary" onClick={handleExportCSV} className="text-xs"><FileDown className="h-4 w-4 mr-1"/> Export CSV</Button></div>
                   <div className="overflow-x-auto">
                     <table className="w-full text-left text-sm">
                       <thead className="bg-slate-50 border-b"><tr><th className="p-3 text-slate-900">Roll No</th><th className="p-3 text-slate-900">Student Name</th><th className="p-3 text-slate-900">Total Classes</th><th className="p-3 text-slate-900">Present</th><th className="p-3 text-slate-900">%</th></tr></thead>
                       <tbody>
                         {students.map(s => {
                            const recs = allClassRecords.filter(r => r.studentId === s.uid);
                            const p = recs.filter(r => r.isPresent).length;
                            const pct = recs.length ? Math.round((p/recs.length)*100) : 0;
                            return (
                              <tr key={s.uid} onClick={() => setViewHistoryStudent(s)} className="border-b cursor-pointer hover:bg-indigo-50 transition-colors">
                                <td className="p-3 font-mono text-slate-900">{s.studentData?.rollNo}</td>
                                <td className="p-3 text-indigo-700 font-medium">{s.displayName}</td>
                                <td className="p-3 text-slate-900">{recs.length}</td>
                                <td className="p-3 text-slate-900">{p}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${pct < 75 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{pct}%</span>
                                </td>
                              </tr>
                            );
                         })}
                       </tbody>
                     </table>
                   </div>
                   <p className="text-xs text-slate-500 mt-4 text-center">Click on a student row to view detailed attendance calendar.</p>
                </div>
              ) : (
                <div className="bg-white border rounded p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <Button variant="secondary" onClick={() => setViewHistoryStudent(null)} className="p-2"><ArrowLeft className="h-5 w-5" /></Button>
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">{viewHistoryStudent.displayName}</h3>
                        <p className="text-sm text-slate-500">{viewHistoryStudent.studentData?.enrollmentId} {viewHistoryStudent.studentData?.rollNo ? `| Roll: ${viewHistoryStudent.studentData.rollNo}` : ''}</p>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="text-sm font-medium text-slate-500">Subject</p>
                       <p className="font-bold text-indigo-700">{metaData.subjects[selSubjectId]?.name}</p>
                    </div>
                  </div>

                  <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Calendar className="h-4 w-4"/> Attendance Log</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {allClassRecords
                      .filter(r => r.studentId === viewHistoryStudent.uid)
                      .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map(r => (
                        <div key={r.id} className={`p-3 rounded-lg border flex flex-col items-center justify-center text-center ${r.isPresent ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                           <div className="text-sm font-bold text-slate-800 mb-1">{r.date}</div>
                           {r.lectureSlot && <div className="text-xs text-slate-500 mb-1">Lecture {r.lectureSlot}</div>}
                           {r.isPresent ? (
                             <div className="flex items-center text-green-700 text-xs font-bold uppercase"><CheckCircle2 className="h-3 w-3 mr-1"/> Present</div>
                           ) : (
                             <div className="flex items-center text-red-700 text-xs font-bold uppercase"><XCircle className="h-3 w-3 mr-1"/> Absent</div>
                           )}
                        </div>
                      ))
                    }
                    {allClassRecords.filter(r => r.studentId === viewHistoryStudent.uid).length === 0 && (
                      <div className="col-span-full text-center p-8 text-slate-400 border border-dashed rounded">
                        No attendance records found for this student.
                      </div>
                    )}
                  </div>
                </div>
              )
           )}
         </>
       )}
    </div>
  );
};
