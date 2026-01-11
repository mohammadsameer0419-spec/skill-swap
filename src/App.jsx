import { Routes, Route, Navigate } from 'react-router-dom'
import { DashboardLayout } from './components/DashboardLayout'
import { DashboardHome } from './pages/DashboardHome'
import { ProfilePage } from './pages/ProfilePage'
import { VerifyCertificate } from './pages/VerifyCertificate'
import Auth from './components/Auth'
import { useAuth } from './hooks/useAuth'

function App() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Routes>
        {/* Public routes */}
        <Route path="/verify/:hash" element={<VerifyCertificate />} />
        
        {/* Protected routes */}
        {user ? (
          <Route
            path="/*"
            element={
              <DashboardLayout>
                <Routes>
                  <Route path="/dashboard" element={<DashboardHome />} />
                  <Route path="/profile/*" element={<ProfilePage />} />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </DashboardLayout>
            }
          />
        ) : (
          <Route path="/*" element={<Auth />} />
        )}
      </Routes>
    </div>
  )
}

export default App
