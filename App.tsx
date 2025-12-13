
import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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

  // Redirect helper for root path
  const RootRedirect = () => {
    if (!user) return <Navigate to="/login" replace />;
    switch (user.role) {
      case UserRole.ADMIN: return <Navigate to="/admin" replace />;
      case UserRole.FACULTY: return <Navigate to="/faculty" replace />;
      case UserRole.STUDENT: return <Navigate to="/student" replace />;
      default: return <div>Unknown Role</div>;
    }
  };

  // Guard for role-based access
  const RequireRole = ({ role, children }: { role: UserRole, children: JSX.Element }) => {
    if (!user) return <Navigate to="/login" replace />;
    if (user.role !== role) return <Navigate to="/" replace />;
    return children;
  };

  return (
    <>
      <Routes>
        <Route
          path="/login"
          element={!user ? <Login onLogin={handleLogin} /> : <Navigate to="/" replace />}
        />

        <Route path="/" element={<RootRedirect />} />

        <Route
          path="/admin"
          element={
            <RequireRole role={UserRole.ADMIN}>
              <Layout
                user={user}
                onLogout={handleLogout}
                onOpenSettings={() => setIsSettingsOpen(true)}
                title="Administrator Portal"
              >
                <AdminDashboard />
              </Layout>
            </RequireRole>
          }
        />

        <Route
          path="/faculty"
          element={
            <RequireRole role={UserRole.FACULTY}>
              <Layout
                user={user}
                onLogout={handleLogout}
                onOpenSettings={() => setIsSettingsOpen(true)}
                title="Faculty Dashboard"
              >
                <FacultyDashboard user={user} />
              </Layout>
            </RequireRole>
          }
        />

        <Route
          path="/student"
          element={
            <RequireRole role={UserRole.STUDENT}>
              <Layout
                user={user}
                onLogout={handleLogout}
                onOpenSettings={() => setIsSettingsOpen(true)}
                title="Student Portal"
              >
                <StudentDashboard user={user} />
              </Layout>
            </RequireRole>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global Settings Modal - Only render if not student and logged in */}
      {user && user.role !== UserRole.STUDENT && (
        <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Profile Settings">
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-800 border-b border-slate-100 pb-2">Change Password</h4>
            <Input
              label="Current Password"
              type="password"
              value={passForm.current}
              onChange={e => setPassForm({ ...passForm, current: e.target.value })}
            />
            <Input
              label="New Password"
              type="password"
              value={passForm.new}
              onChange={e => setPassForm({ ...passForm, new: e.target.value })}
              placeholder="Min 6 characters"
            />
            <Input
              label="Confirm New Password"
              type="password"
              value={passForm.confirm}
              onChange={e => setPassForm({ ...passForm, confirm: e.target.value })}
            />
            <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setIsSettingsOpen(false)} disabled={settingsLoading}>Cancel</Button>
              <Button onClick={handleChangePassword} disabled={!passForm.current || !passForm.new || settingsLoading}>
                {settingsLoading ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default App;
