import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL
console.log(BASE);

export const api = axios.create({
  baseURL: BASE,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
})

api.interceptors.request.use(cfg => {
  const isAgentRoute = window.location.pathname.startsWith('/agent')
  const token = isAgentRoute
    ? (localStorage.getItem('agent_access_token') || localStorage.getItem('access_token'))
    : localStorage.getItem('access_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

let refreshing = false
let queue = []

const drain = (err, token = null) => {
  queue.forEach(p => err ? p.reject(err) : p.resolve(token))
  queue = []
}

api.interceptors.response.use(
  r => r,
  async err => {
    const orig = err.config
    if (err.response?.status !== 401 || orig._retry) return Promise.reject(err)

    if (refreshing) {
      return new Promise((resolve, reject) => queue.push({ resolve, reject }))
        .then(t => { orig.headers.Authorization = `Bearer ${t}`; return api(orig) })
    }

    orig._retry = true
    refreshing  = true

    const isAgentRoute = window.location.pathname.startsWith('/agent')
    const refresh = isAgentRoute
      ? localStorage.getItem('agent_refresh_token')
      : localStorage.getItem('refresh_token')

    if (!refresh) {
      if (isAgentRoute) {
        localStorage.removeItem('agent_access_token')
        localStorage.removeItem('agent_refresh_token')
        window.location.href = '/agent-login'
      } else {
        _logout()
      }
      return Promise.reject(err)
    }

    const refreshEndpoint = isAgentRoute ? '/agents/refresh' : '/auth/refresh'

    try {
      const { data } = await axios.post(`${BASE}${refreshEndpoint}`, { refresh_token: refresh })
      if (isAgentRoute) {
        localStorage.setItem('agent_access_token', data.access_token)
        localStorage.setItem('agent_refresh_token', data.refresh_token)
      } else {
        localStorage.setItem('access_token',  data.access_token)
        localStorage.setItem('refresh_token', data.refresh_token)
      }
      api.defaults.headers.common.Authorization = `Bearer ${data.access_token}`
      drain(null, data.access_token)
      orig.headers.Authorization = `Bearer ${data.access_token}`
      return api(orig)
    } catch (e) {
      drain(e)
      if (isAgentRoute) {
        localStorage.removeItem('agent_access_token')
        localStorage.removeItem('agent_refresh_token')
        window.location.href = '/agent-login'
      } else {
        _logout()
      }
      return Promise.reject(e)
    } finally {
      refreshing = false
    }
  }
)

function _logout() {
  localStorage.clear()
  window.location.href = '/login'
}

export default api
