import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { db } from './services/db';
import { User, UserRole } from './types';
import { Login } from './views/Login';
import { Layout } from './components/Layout';
import { AdminDashboard } from './views/Admin';
import { FacultyDashboard } from './views/Faculty';
import { StudentDashboard } from './views/Student';
import { Modal, Input, Button } from './components/UI';

// Wrapper component to handle auth redirects
const AuthGuard: React.FC<{ children: React.ReactNode; allowedRoles?: UserRole[] }> = ({ children, allowedRoles }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <div className="p-10 text-center">Access Denied: Insufficient Permissions</div>;
  }

  // Pass user prop to children if they expect it
  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      // @ts-ignore - We know these components accept user
      return React.cloneElement(child, { user });
    }
    return child;
  });

  return <>{childrenWithProps}</>;
};

// Main App Layout Wrapper to provide context/props to Layout
const AppLayout: React.FC<{ children: React.ReactNode; user?: User }> = ({ children, user: propUser }) => {
  const [user, setUser] = useState<User | null>(propUser || null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [passForm, setPassForm] = useState({ current: '', new: '', confirm: '' });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (propUser) {
      setUser(propUser);
    } else {
      db.getCurrentUser().then(setUser).catch(() => setUser(null));
    }
  }, [propUser]);

  const handleLogout = async () => {
    await db.logout();
    setUser(null);
    navigate('/login');
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

  const getPortalTitle = () => {
    if (!user) return 'Acropolis AMS';
    switch (user.role) {
      case UserRole.ADMIN: return 'Administrator Portal';
      case UserRole.FACULTY: return 'Faculty Dashboard';
      case UserRole.STUDENT: return 'Student Portal';
      default: return 'Acropolis AMS';
    }
  };

  if (!user) return null; // Should be handled by AuthGuard but safe to have

  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      // @ts-ignore
      return React.cloneElement(child, { user });
    }
    return child;
  });

  return (
    <>
      <Layout
        user={user}
        onLogout={handleLogout}
        onOpenSettings={() => setIsSettingsOpen(true)}
        title={getPortalTitle()}
      >
        {childrenWithProps}
      </Layout>

      {user.role !== UserRole.STUDENT && (
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

const LoginWrapper = () => {
  const navigate = useNavigate();
  const handleLogin = (user: User) => {
    if (user.role === UserRole.ADMIN) navigate('/admin');
    else if (user.role === UserRole.FACULTY) navigate('/faculty');
    else if (user.role === UserRole.STUDENT) navigate('/student');
    else navigate('/');
  };
  return <Login onLogin={handleLogin} />;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginWrapper />} />

        <Route path="/admin" element={
          <AuthGuard allowedRoles={[UserRole.ADMIN]}>
            <AppLayout>
              <AdminDashboard />
            </AppLayout>
          </AuthGuard>
        } />

        <Route path="/faculty" element={
          <AuthGuard allowedRoles={[UserRole.FACULTY]}>
            <AppLayout>
              <FacultyDashboard user={{} as User} /> {/* User injected by AuthGuard/AppLayout logic or we need to fix prop drilling */}
            </AppLayout>
          </AuthGuard>
        } />

        <Route path="/student" element={
          <AuthGuard allowedRoles={[UserRole.STUDENT]}>
            <AppLayout>
              <StudentDashboard user={{} as User} />
            </AppLayout>
          </AuthGuard>
        } />

        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
