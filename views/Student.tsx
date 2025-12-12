import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { User, Subject, AttendanceRecord } from '../types';
import { Card } from '../components/UI';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface StudentProps { user: User; }

export const StudentDashboard: React.FC<StudentProps> = ({ user }) => {
   const [subjects, setSubjects] = useState<Subject[]>([]);
   const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
   const [loading, setLoading] = useState(true);

   useEffect(() => {
      const loadData = async () => {
         const { branchId, batchId } = user.studentData || {};
         if (!branchId || !batchId) { setLoading(false); return; }

         const allAssignments = await db.getAssignments();
         const myClassAssignments = allAssignments.filter(a =>
            a.branchId === branchId &&
            (a.batchId === batchId || a.batchId === 'ALL')
         );
         const mySubjectIds = new Set(myClassAssignments.map(a => a.subjectId));

         const allSubs = await db.getSubjects();
         setSubjects(allSubs.filter(s => mySubjectIds.has(s.id)).sort((a, b) => a.name.localeCompare(b.name)));
         setAttendance(await db.getStudentAttendance(user.uid));
         setLoading(false);
      };
      loadData();
   }, [user.uid]);

   const calc = (sid: string) => {
      const rel = attendance.filter(a => a.subjectId === sid);
      const tot = rel.length;
      const pres = rel.filter(a => a.isPresent).length;
      return { tot, pres, pct: tot === 0 ? 0 : Math.round((pres / tot) * 100) };
   };

   if (loading) return <div>Loading...</div>;

   return (
      <div className="space-y-6">
         <div className="bg-indigo-900 text-white p-6 rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold">Hello, {user.displayName}</h2>
            <p className="opacity-80 font-mono text-sm">Enrollment: {user.studentData?.enrollmentId}</p>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {subjects.length > 0 ? subjects.map(s => {
               const { tot, pres, pct } = calc(s.id);
               const isLow = pct < 75;
               const radius = 30;
               const circumference = 2 * Math.PI * radius;
               const strokeDashoffset = circumference - (pct / 100) * circumference;

               return (
                  <Card key={s.id} className="border border-slate-200">
                     <div className="flex justify-between items-start mb-4">
                        <div>
                           <h3 className="font-bold text-lg text-slate-900">{s.name}</h3>
                           <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500">{s.code}</span>
                        </div>
                        <div className="relative flex items-center justify-center">
                           <svg className="transform -rotate-90 w-16 h-16">
                              <circle cx="32" cy="32" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-200" />
                              <circle cx="32" cy="32" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className={isLow ? "text-red-500" : "text-green-500"} />
                           </svg>
                           <span className={`absolute text-sm font-bold ${isLow ? 'text-red-600' : 'text-indigo-600'}`}>{pct}%</span>
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-4 text-center border-t border-slate-100 pt-3">
                        <div>
                           <p className="text-xs text-slate-500 uppercase">Classes</p>
                           <p className="font-semibold text-slate-800">{pres} / {tot}</p>
                        </div>
                        <div>
                           <p className="text-xs text-slate-500 uppercase">Status</p>
                           {isLow ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Low Attendance</span>
                           ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">On Track</span>
                           )}
                        </div>
                     </div>
                  </Card>
               )
            }) : <div className="col-span-3 text-center p-10 text-slate-500 border border-dashed rounded">No subjects assigned.</div>}
         </div>
      </div>
   );
};
