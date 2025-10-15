#!/bin/bash

# ClubRRRR Frontend Auto-Builder
# This script creates ALL frontend files automatically

echo "🚀 ClubRRRR Frontend Auto-Builder"
echo "=================================="
echo ""

# Check if we're in the right directory
if [ ! -d "frontend" ]; then
    echo "❌ Error: frontend directory not found!"
    echo "Please run this script from the clubrrrr-system directory"
    exit 1
fi

echo "✅ Found frontend directory"
echo "📝 Creating all frontend files..."
echo ""

# Create all directories
mkdir -p frontend/src/{components/{common,layout,crm,calendar,tasks,finance,dashboard},pages,services,hooks,context,utils,types}

echo "Step 1/10: Creating API Service..."
cat > frontend/src/services/api.ts << 'EOF'
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
EOF

echo "Step 2/10: Creating Auth Service..."
cat > frontend/src/services/auth.service.ts << 'EOF'
import api from './api';

export const authService = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: any) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
};
EOF

echo "Step 3/10: Creating Auth Context..."
cat > frontend/src/context/AuthContext.tsx << 'EOF'
import React, { createContext, useContext, useState } from 'react';
import { authService } from '../services/auth.service';

interface AuthContextType {
  user: any;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState(null);

  const login = async (email: string, password: string) => {
    const { data } = await authService.login(email, password);
    localStorage.setItem('accessToken', data.data.accessToken);
    setUser(data.data.user);
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
EOF

echo "Step 4/10: Creating Login Page..."
cat > frontend/src/pages/LoginPage.tsx << 'EOF'
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      toast.success('התחברת בהצלחה!');
      navigate('/dashboard');
    } catch (error) {
      toast.error('שגיאה בהתחברות');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-center mb-6">ClubRRRR</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">אימייל</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">סיסמה</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
          >
            התחבר
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
EOF

echo "Step 5/10: Creating Dashboard Page..."
cat > frontend/src/pages/DashboardPage.tsx << 'EOF'
import { useAuth } from '../context/AuthContext';

const DashboardPage = () => {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">דשבורד</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm">לידים חדשים</h3>
          <p className="text-3xl font-bold mt-2">42</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm">מחזורים פעילים</h3>
          <p className="text-3xl font-bold mt-2">5</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm">תלמידים</h3>
          <p className="text-3xl font-bold mt-2">127</p>
        </div>
      </div>
      <div className="mt-6">
        <p>שלום {user?.firstName}!</p>
      </div>
    </div>
  );
};

export default DashboardPage;
EOF

echo "Step 6/10: Creating Placeholder Pages..."
for page in LeadsPage CyclesPage CalendarPage TasksPage FinancePage StudentsPage; do
  cat > frontend/src/pages/${page}.tsx << EOF
const ${page} = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold">${page}</h1>
      <p className="mt-4">עמוד זה בבניה...</p>
    </div>
  );
};

export default ${page};
EOF
done

echo "Step 7/10: Creating Layout Components..."
cat > frontend/src/components/layout/Sidebar.tsx << 'EOF'
import { Link } from 'react-router-dom';

const Sidebar = ({ isOpen }: { isOpen: boolean }) => {
  const menuItems = [
    { path: '/dashboard', label: 'דשבורד' },
    { path: '/leads', label: 'לידים' },
    { path: '/cycles', label: 'מחזורים' },
    { path: '/calendar', label: 'לוח שנה' },
    { path: '/tasks', label: 'משימות' },
    { path: '/finance', label: 'פיננסים' },
    { path: '/students', label: 'תלמידים' },
  ];

  return (
    <div className={\`\${isOpen ? 'w-64' : 'w-0'} bg-gray-800 text-white transition-all duration-300 overflow-hidden\`}>
      <div className="p-4">
        <h2 className="text-xl font-bold mb-8">ClubRRRR</h2>
        <nav>
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="block py-2 px-4 hover:bg-gray-700 rounded"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default Sidebar;
EOF

cat > frontend/src/components/layout/Header.tsx << 'EOF'
import { useAuth } from '../../context/AuthContext';

const Header = ({ onMenuClick }: { onMenuClick: () => void }) => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
      <button onClick={onMenuClick} className="text-gray-600">
        ☰
      </button>
      <div className="flex items-center gap-4">
        <span>{user?.firstName}</span>
        <button onClick={logout} className="text-red-600">
          התנתק
        </button>
      </div>
    </header>
  );
};

export default Header;
EOF

cat > frontend/src/components/layout/Layout.tsx << 'EOF'
import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen">
      <Sidebar isOpen={sidebarOpen} />
      <div className="flex-1 flex flex-col">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-auto p-6 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
EOF

echo "Step 8/10: Creating PrivateRoute..."
cat > frontend/src/components/PrivateRoute.tsx << 'EOF'
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from './layout/Layout';

const PrivateRoute = () => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

export default PrivateRoute;
EOF

echo "Step 9/10: Creating .env.example..."
cat > frontend/.env.example << 'EOF'
VITE_API_URL=http://localhost:5000/api
EOF

echo "Step 10/10: Creating README..."
cat > frontend/README.md << 'EOF'
# ClubRRRR Frontend

## התקנה

```bash
npm install
```

## הגדרת משתנים

```bash
cp .env.example .env
# ערוך .env לפי הצורך
```

## הרצה

```bash
npm run dev
```

Frontend יעלה על: http://localhost:3000

## משתמש ברירת מחדל

Email: admin@clubrrrr.com
Password: Admin123!

(שנה אחרי כניסה ראשונה!)
EOF

echo ""
echo "✅ כל הקבצים נוצרו בהצלחה!"
echo ""
echo "📝 צעדים הבאים:"
echo "1. cd frontend"
echo "2. npm install"
echo "3. cp .env.example .env"
echo "4. npm run dev"
echo ""
echo "🚀 Frontend יעלה על http://localhost:3000"
echo "🔐 משתמש: admin@clubrrrr.com / Admin123!"
echo ""
echo "✅ הצלחה!"
