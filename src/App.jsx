import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login       from './pages/auth/Login'
import Register    from './pages/auth/Register'
import Onboarding  from './pages/onboarding/Onboarding'
import Layout      from './pages/dashboard/Layout'
import Dashboard   from './pages/dashboard/Dashboard'
import Inbox       from './pages/dashboard/Inbox'
import Contacts    from './pages/dashboard/Contacts'
import Broadcasts  from './pages/dashboard/Broadcasts'
import Templates   from "./pages/dashboard/Templates"
// These still use named exports from Pages.jsx
import { Analytics, Agents, Settings } from './pages/dashboard/Pages'
import Automations from './pages/dashboard/Automations'

function Protected({ children }) {
  const token = localStorage.getItem('access_token')
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"      element={<Login />} />
        <Route path="/register"   element={<Register />} />
        <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
        <Route path="/dashboard"  element={<Protected><Layout /></Protected>}>
          <Route index               element={<Dashboard />} />
          <Route path="inbox"        element={<Inbox />} />
          <Route path="contacts"     element={<Contacts />} />
          <Route path="broadcasts"   element={<Broadcasts />} />
          <Route path="templates"    element={<Templates />} />
          <Route path="analytics"    element={<Analytics />} />
          <Route path="automations"  element={<Automations />} />
          <Route path="agents"       element={<Agents />} />
          <Route path="settings"     element={<Settings />} />
        </Route>
        <Route path="/"  element={<Navigate to="/dashboard" replace />} />
        <Route path="*"  element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}