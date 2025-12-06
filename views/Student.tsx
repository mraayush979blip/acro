import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { User, Subject, AttendanceRecord } from '../types';
import { Card } from '../components/UI';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface StudentProps {
  user: User;
}

// Helper: Circular Progress Component
const CircularProgress: React.FC<{ percentage: number; size?: number; strokeWidth?: number; colorClass?: string }> = 
  ({ percentage, size = 80, strokeWidth = 8, colorClass = "text-indigo-600" }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90 w-full h-full">
        {/* Track */}
        <circle
          className="text-slate-100"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Indicator */}
        <circle
          className={`transition-all duration-1000 ease-out ${colorClass}`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <span className={`absolute text-lg font-bold ${colorClass}`}>
        {percentage}%
      </span>
    </div>
  );
};

export const StudentDashboard: React.FC<StudentProps> = ({ user }) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      // 1. Get all subjects (in a real app, we filter by branch)
      const allSubs = await db.getSubjects();
      setSubjects(allSubs);

      // 2. Get my attendance
      const myAtt = await db.getStudentAttendance(user.uid);
      setAttendance(myAtt);
      
      setLoading(false);
    };
    loadData();
  }, [user.uid]);

  const calculateStats = (subjectId: string) => {
    const relevant = attendance.filter(a => a.subjectId === subjectId);
    const total = relevant.length;
    const present = relevant.filter(a => a.isPresent).length;
    const percentage = total === 0 ? 0 : Math.round((present / total) * 100);
    return { total, present, percentage };
  };

  if (loading) return <div className="p-12 text-center text-slate-500">Loading records...</div>;

  return (
    <div className="space-y-8">
      {/* Header Profile Card */}
      <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 rounded-xl p-6 text-white shadow-xl flex justify-between items-center relative overflow-hidden">
        <div className="relative z-10">
           <h2 className="text-3xl font-bold mb-1">Hello, {user.displayName.split(' ')[0]}</h2>
           <p className="text-indigo-200 font-mono text-sm opacity-90">
             Enrollment: {user.studentData?.enrollmentId} | {user.studentData?.branchId?.replace('b_', '').toUpperCase()}
           </p>
        </div>
        {/* Decorative Circle */}
        <div className="absolute -right-10 -bottom-20 w-64 h-64 bg-white opacity-5 rounded-full pointer-events-none"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {subjects.map(subject => {
          const { total, present, percentage } = calculateStats(subject.id);
          const isLow = percentage < 75;
          const statusColor = isLow ? 'text-red-600' : 'text-emerald-600';
          
          // Demo fallback for display (if 0 records, show 100% or 0%)
          const dispPercent = total === 0 ? 0 : percentage; 

          return (
            <Card key={subject.id} className="relative overflow-hidden transition-shadow hover:shadow-md border border-slate-200">
              <div className="flex justify-between items-start mb-6">
                <div>
                   <h3 className="font-bold text-slate-900 text-lg leading-tight mb-1">{subject.name}</h3>
                   <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{subject.code}</span>
                </div>
                {/* Circular Chart */}
                <CircularProgress 
                  percentage={dispPercent} 
                  size={60} 
                  strokeWidth={5} 
                  colorClass={isLow && total > 0 ? 'text-red-500' : 'text-indigo-600'} 
                />
              </div>

              {/* Stats Grid */}
              <div className="bg-slate-50 rounded-lg p-3 grid grid-cols-2 gap-4 border border-slate-100">
                <div>
                   <p className="text-xs text-slate-500 uppercase font-semibold">Attended</p>
                   <p className="text-lg font-bold text-slate-800">{present} <span className="text-xs text-slate-400 font-normal">/ {total}</span></p>
                </div>
                <div className="text-right">
                   <p className="text-xs text-slate-500 uppercase font-semibold">Status</p>
                   <div className={`inline-flex items-center text-sm font-bold ${statusColor}`}>
                     {total === 0 ? (
                       <span className="text-slate-400 font-normal italic">No data</span>
                     ) : isLow ? (
                       <><AlertCircle className="h-4 w-4 mr-1" /> Low</>
                     ) : (
                       <><CheckCircle2 className="h-4 w-4 mr-1" /> On Track</>
                     )}
                   </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};