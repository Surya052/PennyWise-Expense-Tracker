import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { ToastProvider } from './lib/toast'
import { Shell } from './components/Shell'
import { Login } from './pages/Login'
import { Forgot } from './pages/Forgot'
import { Reset } from './pages/Reset'
import { ChangePassword } from './pages/ChangePassword'
import { Home } from './pages/Home'
import { Transactions } from './pages/Transactions'
import { AddTransaction } from './pages/AddTransaction'
import { Investments } from './pages/Investments'
import { More } from './pages/More'
import { Settings } from './pages/Settings'
import { Accounts } from './pages/Accounts'
import { Categories } from './pages/Categories'
import { Budgets } from './pages/Budgets'
import { Goals } from './pages/Goals'
import { Recurring } from './pages/Recurring'
import { Reports } from './pages/Reports'
import { Admin } from './pages/Admin'

function Spinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-[var(--muted)]">
      Loading…
    </div>
  )
}

function RequireAuth() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />
  return <Outlet />
}

function RequirePasswordChange() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (!user.mustChangePassword) return <Navigate to="/" replace />
  return <Outlet />
}

function PublicOnly() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (user && !user.mustChangePassword) return <Navigate to="/" replace />
  if (user?.mustChangePassword) return <Navigate to="/change-password" replace />
  return <Outlet />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route element={<PublicOnly />}>
              <Route path="/login" element={<Login />} />
              <Route path="/forgot" element={<Forgot />} />
              <Route path="/reset" element={<Reset />} />
            </Route>
            <Route element={<RequirePasswordChange />}>
              <Route path="/change-password" element={<ChangePassword />} />
            </Route>
            <Route element={<RequireAuth />}>
              <Route element={<Shell />}>
                <Route index element={<Home />} />
                <Route path="transactions" element={<Transactions />} />
                <Route path="investments" element={<Investments />} />
                <Route path="more" element={<More />} />
                <Route path="settings" element={<Settings />} />
                <Route path="accounts" element={<Accounts />} />
                <Route path="categories" element={<Categories />} />
                <Route path="budgets" element={<Budgets />} />
                <Route path="goals" element={<Goals />} />
                <Route path="recurring" element={<Recurring />} />
                <Route path="reports" element={<Reports />} />
                <Route path="admin" element={<Admin />} />
              </Route>
              <Route path="add" element={<AddTransaction />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
