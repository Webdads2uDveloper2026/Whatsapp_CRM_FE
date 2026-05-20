import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL

export const agentApi = axios.create({
  baseURL: BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

agentApi.interceptors.request.use(cfg => {
  const token = localStorage.getItem('agent_access_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

let refreshing = false
let queue = []

const drain = (err, token = null) => {
  queue.forEach(p => err ? p.reject(err) : p.resolve(token))
  queue = []
}

agentApi.interceptors.response.use(
  r => r,
  async err => {
    const orig = err.config
    if (err.response?.status !== 401 || orig._retry) return Promise.reject(err)

    if (refreshing) {
      return new Promise((resolve, reject) => queue.push({ resolve, reject }))
        .then(t => { orig.headers.Authorization = `Bearer ${t}`; return agentApi(orig) })
    }

    orig._retry = true
    refreshing  = true

    const refresh = localStorage.getItem('agent_refresh_token')
    if (!refresh) { _agentLogout(); return Promise.reject(err) }

    try {
      const { data } = await axios.post(`${BASE}/agents/refresh`, { refresh_token: refresh })
      localStorage.setItem('agent_access_token',  data.access_token)
      localStorage.setItem('agent_refresh_token', data.refresh_token)
      agentApi.defaults.headers.common.Authorization = `Bearer ${data.access_token}`
      drain(null, data.access_token)
      orig.headers.Authorization = `Bearer ${data.access_token}`
      return agentApi(orig)
    } catch (e) {
      drain(e)
      _agentLogout()
      return Promise.reject(e)
    } finally {
      refreshing = false
    }
  }
)

function _agentLogout() {
  localStorage.removeItem('agent_access_token')
  localStorage.removeItem('agent_refresh_token')
  localStorage.removeItem('agent_data')
  window.location.href = '/agent-login'
}

export default agentApi
