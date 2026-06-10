import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Auth
import Login          from './pages/auth/Login'
import Register       from './pages/auth/Register'
import GoogleCallback from './pages/auth/GoogleCallback'
import AgentLogin     from './pages/auth/AgentLogin'

// Super Admin portal
import SuperAdminLogin    from './pages/super-admin/SuperAdminLogin'
import SuperAdminLayout   from './pages/super-admin/SuperAdminLayout'
import SADashboard        from './pages/super-admin/SADashboard'
import SAAdmins           from './pages/super-admin/SAAdmins'
import SAAdminDetail      from './pages/super-admin/SAAdminDetail'
import SAPlans            from './pages/super-admin/SAPlans'
import SubscriptionPlans  from './pages/super-admin/SubscriptionPlans'

// Admin (Tenant Owner) portal
import Onboarding  from './pages/onboarding/Onboarding'
import Layout      from './pages/dashboard/Layout'
import Dashboard   from './pages/dashboard/Dashboard'
import Inbox       from './pages/dashboard/Inbox'
import Contacts    from './pages/dashboard/Contacts'
import Broadcasts  from './pages/dashboard/Broadcasts'
import Templates   from './pages/dashboard/Templates'
import Settings    from './pages/dashboard/Settings'
import Automations from './pages/dashboard/Automations'
import Flows       from './pages/dashboard/Flows'
import { Analytics, Agents } from './pages/dashboard/Pages'
import Reports          from './pages/dashboard/Reports'
import FacebookLeads     from './pages/dashboard/FacebookLeads'
import FacebookCampaigns from './pages/dashboard/FacebookCampaigns'
import Integrations      from './pages/dashboard/Integrations'
import Connector        from './pages/dashboard/Connector'

// Agent portal
import AgentLayout   from './pages/agent/AgentLayout'
import AgentOverview from './pages/agent/AgentOverview'
import AgentTeam     from './pages/agent/AgentTeam'
import AgentSettings from './pages/agent/AgentSettings'

// Route guards
function ProtectedSA({ children }) {
  return localStorage.getItem('sa_access_token')
    ? children
    : <Navigate to="/super-admin/login" replace />
}

function ProtectedAdmin({ children }) {
  return localStorage.getItem('access_token')
    ? children
    : <Navigate to="/login" replace />
}

function ProtectedAgent({ children }) {
  return localStorage.getItem('agent_access_token')
    ? children
    : <Navigate to="/agent-login" replace />
}

function SmartRedirect() {
  if (localStorage.getItem('sa_access_token'))    return <Navigate to="/super-admin" replace />
  if (localStorage.getItem('agent_access_token')) return <Navigate to="/agent"       replace />
  if (localStorage.getItem('access_token'))       return <Navigate to="/dashboard"   replace />
  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ── Public ── */}
        <Route path="/login"               element={<Login />} />
        <Route path="/register"            element={<Register />} />
        <Route path="/auth/google/success" element={<GoogleCallback />} />
        <Route path="/agent-login"         element={<AgentLogin />} />
        <Route path="/super-admin/login"   element={<SuperAdminLogin />} />

        {/* ── Super Admin Portal ── */}
        <Route path="/super-admin" element={<ProtectedSA><SuperAdminLayout /></ProtectedSA>}>
          <Route index                    element={<SADashboard />} />
          <Route path="admins"            element={<SAAdmins />} />
          <Route path="admins/:id"        element={<SAAdminDetail />} />
          <Route path="plans"             element={<SAPlans />} />
          <Route path="subscription-plans" element={<SubscriptionPlans />} />
        </Route>

        {/* ── Admin (Tenant Owner) Portal ── */}
        <Route path="/onboarding" element={<ProtectedAdmin><Onboarding /></ProtectedAdmin>} />
        <Route path="/dashboard"  element={<ProtectedAdmin><Layout /></ProtectedAdmin>}>
          <Route index               element={<Dashboard />} />
          <Route path="inbox"        element={<Inbox />} />
          <Route path="contacts"     element={<Contacts />} />
          <Route path="broadcasts"   element={<Broadcasts />} />
          <Route path="templates"    element={<Templates />} />
          <Route path="analytics"    element={<Analytics />} />
          <Route path="reports"      element={<Reports />} />
          <Route path="automations"  element={<Automations />} />
          <Route path="flows"        element={<Flows />} />
          <Route path="agents"              element={<Agents />} />
          <Route path="settings"            element={<Settings />} />
          <Route path="facebook-leads"      element={<FacebookLeads />} />
          <Route path="facebook-campaigns"  element={<FacebookCampaigns />} />
          <Route path="integrations"        element={<Integrations />} />
          <Route path="connector"           element={<Connector />} />
        </Route>

        {/* ── Agent Portal ── */}
        <Route path="/agent" element={<ProtectedAgent><AgentLayout /></ProtectedAgent>}>
          <Route index              element={<AgentOverview />} />
          <Route path="inbox"       element={<Inbox />} />
          <Route path="contacts"    element={<Contacts />} />
          <Route path="broadcasts"  element={<Broadcasts />} />
          <Route path="templates"   element={<Templates />} />
          <Route path="analytics"   element={<Analytics />} />
          <Route path="automations" element={<Automations />} />
          <Route path="flows"       element={<Flows />} />
          <Route path="team"        element={<AgentTeam />} />
          <Route path="settings"    element={<AgentSettings />} />
        </Route>

        {/* ── Fallbacks ── */}
        <Route path="/"  element={<SmartRedirect />} />
        <Route path="*"  element={<SmartRedirect />} />

      </Routes>
    </BrowserRouter>
  )
}
