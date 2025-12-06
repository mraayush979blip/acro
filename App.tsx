import React, { useEffect, useState } from 'react';
import { db } from './services/db';
import { User, UserRole } from './types';
import { Login } from './views/Login';
import { Layout } from './components/Layout';
import { AdminDashboard } from './views/Admin';
import { FacultyDashboard } from './views/Faculty';
import { StudentDashboard } from './views/Student';
import { Modal, Input, Button } from './components/UI';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Settings / Password Change State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [passForm, setPassForm] = useState({ current: '', new: '', confirm: '' });
  const [settingsLoading, setSettingsLoading] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const u = await db.getCurrentUser();
        setUser(u);
      } catch (e) {
        console.error("Auth check failed", e);
      } finally {
        setLoading(false);
      }
    };
    checkUser();
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
  };

  const handleLogout = async () => {
    await db.logout();
    setUser(null);
  };

  const handleChangePassword = async () => {
    if (passForm.new !== passForm.confirm) {
      alert("New passwords do not match.");
      return;
    }
    if (passForm.new.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }
    setSettingsLoading(true);
    try {
      await db.changePassword(passForm.current, passForm.new);
      alert("Password changed successfully.");
      setIsSettingsOpen(false);
      setPassForm({ current: '', new: '', confirm: '' });
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setSettingsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // --- Role-Based Navigation Guards ---
  const renderPortal = () => {
    switch (user.role) {
      case UserRole.ADMIN:
        return <AdminDashboard />;
      case UserRole.FACULTY:
        return <FacultyDashboard user={user} />;
      case UserRole.STUDENT:
        return <StudentDashboard user={user} />;
      default:
        // Guard against invalid roles
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center">
            <div className="bg-red-50 text-red-600 p-6 rounded-lg border border-red-200 max-w-md">
              <h2 className="text-xl font-bold mb-2">Access Denied</h2>
              <p className="mb-4">Your account does not have a valid role assigned (Admin, Faculty, or Student). Please contact the administrator.</p>
              <button 
                onClick={handleLogout}
                className="px-4 py-2 bg-white border border-red-300 rounded hover:bg-red-50 text-red-700 font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        );
    }
  };

  const getPortalTitle = () => {
    switch (user.role) {
      case UserRole.ADMIN: return 'Administrator Portal';
      case UserRole.FACULTY: return 'Faculty Dashboard';
      case UserRole.STUDENT: return 'Student Portal';
      default: return 'Acropolis AMS';
    }
  };

  return (
    <>
      <Layout 
        user={user} 
        onLogout={handleLogout} 
        onOpenSettings={() => setIsSettingsOpen(true)}
        title={getPortalTitle()}
      >
        {renderPortal()}
      </Layout>

      {/* Global Settings Modal */}
      <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Profile Settings">
         <div className="space-y-4">
            <h4 className="font-semibold text-slate-800 border-b border-slate-100 pb-2">Change Password</h4>
            <Input 
               label="Current Password" 
               type="password" 
               value={passForm.current} 
               onChange={e => setPassForm({...passForm, current: e.target.value})} 
            />
            <Input 
               label="New Password" 
               type="password" 
               value={passForm.new} 
               onChange={e => setPassForm({...passForm, new: e.target.value})}
               placeholder="Min 6 characters"
            />
             <Input 
               label="Confirm New Password" 
               type="password" 
               value={passForm.confirm} 
               onChange={e => setPassForm({...passForm, confirm: e.target.value})} 
            />
            <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-slate-100">
               <Button variant="secondary" onClick={() => setIsSettingsOpen(false)} disabled={settingsLoading}>Cancel</Button>
               <Button onClick={handleChangePassword} disabled={!passForm.current || !passForm.new || settingsLoading}>
                 {settingsLoading ? 'Updating...' : 'Update Password'}
               </Button>
            </div>
         </div>
      </Modal>
    </>
  );
};

export default App;