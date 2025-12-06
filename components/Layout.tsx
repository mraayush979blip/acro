import React, { useState, useRef, useEffect } from 'react';
import { LogOut, User as UserIcon, Menu, X, ChevronDown, Settings } from 'lucide-react';
import { User, UserRole } from '../types';
import { db } from '../services/db';
import { AcropolisLogo } from './UI';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
  onOpenSettings: () => void;
  title: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, onOpenSettings, title }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Navbar */}
      <header className="bg-indigo-900 text-white shadow-md relative z-20">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-white rounded-md p-1 flex items-center justify-center flex-shrink-0">
               <AcropolisLogo className="h-full w-full" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Acropolis AMS</h1>
              <p className="text-xs text-indigo-200 hidden sm:block">Attendance Management System</p>
            </div>
          </div>
          
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center space-x-3 p-2 hover:bg-indigo-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-expanded={isMenuOpen}
              aria-haspopup="true"
            >
              <div className="hidden md:flex flex-col items-end">
                <span className="text-sm font-semibold leading-none">{user.displayName}</span>
                <span className="text-xs text-indigo-300 uppercase tracking-wider mt-0.5">{user.role}</span>
              </div>
              <div className="h-8 w-8 bg-indigo-700 rounded-full flex items-center justify-center border border-indigo-600">
                <Menu className="h-5 w-5" />
              </div>
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
                <div className="p-5 border-b border-slate-100 bg-slate-50">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="h-12 w-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl font-bold">
                      {user.displayName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 leading-tight">{user.displayName}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      {user.role}
                    </span>
                    {user.studentData?.enrollmentId && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 font-mono">
                        {user.studentData.enrollmentId}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="p-2">
                  <button 
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenSettings();
                    }}
                    className="w-full flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 rounded-md transition-colors"
                  >
                    <Settings className="h-4 w-4 mr-3" />
                    Settings
                  </button>
                  <button 
                    onClick={() => {
                      setIsMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <LogOut className="h-4 w-4 mr-3" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
        </div>
        {children}
      </main>

      <footer className="bg-slate-200 text-slate-600 py-4 text-center text-sm border-t border-slate-300">
        &copy; {new Date().getFullYear()} Acropolis Institute. All rights reserved.
      </footer>
    </div>
  );
};