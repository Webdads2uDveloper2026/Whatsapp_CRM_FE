import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL

export const superAdminApi = axios.create({
  baseURL: BASE,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
})

superAdminApi.interceptors.request.use(cfg => {
  const token = localStorage.getItem('sa_access_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

let refreshing = false
let queue = []

const drain = (err, token = null) => {
  queue.forEach(p => err ? p.reject(err) : p.resolve(token))
  queue = []
}

superAdminApi.interceptors.response.use(
  r => r,
  async err => {
    const orig = err.config
    if (err.response?.status !== 401 || orig._retry) return Promise.reject(err)
    if (refreshing) {
      return new Promise((resolve, reject) => queue.push({ resolve, reject }))
        .then(t => { orig.headers.Authorization = `Bearer ${t}`; return superAdminApi(orig) })
    }
    orig._retry = true
    refreshing = true
    const refresh = localStorage.getItem('sa_refresh_token')
    if (!refresh) { _saLogout(); return Promise.reject(err) }
    try {
      const { data } = await axios.post(`${BASE}/super-admin/refresh`, { refresh_token: refresh })
      localStorage.setItem('sa_access_token', data.access_token)
      localStorage.setItem('sa_refresh_token', data.refresh_token)
      superAdminApi.defaults.headers.common.Authorization = `Bearer ${data.access_token}`
      drain(null, data.access_token)
      orig.headers.Authorization = `Bearer ${data.access_token}`
      return superAdminApi(orig)
    } catch (e) {
      drain(e); _saLogout(); return Promise.reject(e)
    } finally {
      refreshing = false
    }
  }
)

function _saLogout() {
  localStorage.removeItem('sa_access_token')
  localStorage.removeItem('sa_refresh_token')
  window.location.href = '/super-admin/login'
}

export default superAdminApi
