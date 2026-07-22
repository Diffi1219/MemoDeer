import axios from 'axios'

/**
 * 获取 API 基础地址
 * - PC 端：返回 /api，由 Vite 代理转发到 localhost:8000
 * - 手机端：用户在设置中填写了 PC 局域网 IP（如 http://192.168.1.12:8000），
 *   则直接请求该地址，绕过 Vite 代理
 */
export function getApiBaseUrl(): string {
  const stored = localStorage.getItem('apiBaseUrl')
  if (stored) {
    // 手机直接访问后端，拼接 /api 前缀
    return stored.replace(/\/+$/, '') + '/api'
  }
  // PC 端走 Vite 代理
  return '/api'
}

/**
 * 构建完整的 API URL（用于 fetch 等非 axios 场景）
 */
export function getApiUrl(path: string): string {
  return getApiBaseUrl() + path
}

const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' },
})

// 请求拦截器：动态更新 baseURL + 自动添加 token
apiClient.interceptors.request.use((config) => {
  // 每次请求时重新读取 baseURL，支持用户在设置中动态切换
  config.baseURL = getApiBaseUrl()

  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：401 自动跳转登录
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export default apiClient
