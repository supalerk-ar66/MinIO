import { ref, computed } from 'vue'

// จัดการสถานะการล็อกอิน (token/user) ฝั่ง frontend และสื่อสารกับ API auth

export interface AuthUser {
  id: string
  username: string
  email: string | null
  role: 'admin' | 'user'
  createdAt: string
}

let state: any = null

function createState() {
  const accessToken = ref<string | null>(null)
  const user = ref<AuthUser | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const initAuth = () => {
    if (!process.client) return

    const token = localStorage.getItem('accessToken')
    const u = localStorage.getItem('user')

    accessToken.value = token
    if (u) user.value = JSON.parse(u)
  }

  const isAuthenticated = computed(() => !!accessToken.value)

  const login = async (username: string, password: string) => {
    isLoading.value = true
    error.value = null

    try {
      const res = await $fetch('/api/auth/login', {
        method: 'POST',
        body: { username, password },
        credentials: "include"
      })

      accessToken.value = res.accessToken
      user.value = normalizeUser(res.user)

      if (process.client) {
        localStorage.setItem('accessToken', res.accessToken)
        localStorage.setItem('user', JSON.stringify(res.user))
      }

      return true
    } catch (e: any) {
      error.value = e?.data?.message || 'Login failed'
      return false
    } finally {
      isLoading.value = false
    }
  }

  const logout = () => {
    if (process.client) {
      $fetch('/api/auth/logout', { method: 'POST', credentials: "include" }).catch(() => {})
    }
    accessToken.value = null
    user.value = null
    if (process.client) {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('user')
    }
  }

  const refreshAccessToken = async () => {
    try {
      const r = await $fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: "include"
      })

      accessToken.value = r.accessToken
      if (process.client) {
        localStorage.setItem('accessToken', r.accessToken)
      }

      user.value = normalizeUser(r.user)
      return true
    } catch {
      logout()
      return false
    }
  }

  const fetchUser = async () => {
    if (!accessToken.value) return false

    try {
      const r = await $fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${accessToken.value}` }
      })
      user.value = normalizeUser(r.user)
      if (process.client) {
        localStorage.setItem('user', JSON.stringify(r.user))
      }
      return true
    } catch {
      return false
    }
  }

  return {
    accessToken,
    user,
    isLoading,
    error,
    isAuthenticated,
    initAuth,
    login,
    logout,
    refreshAccessToken,
    fetchUser,
  }
}

function normalizeUser(raw: any): AuthUser {
  if (!raw) {
    throw new Error('Missing user payload')
  }
  const role = raw.role === 'admin' ? 'admin' : 'user'
  return {
    id: raw.id,
    username: raw.username,
    email: raw.email ?? null,
    role,
    createdAt: raw.createdAt,
  }
}

export function useAuth() {
  if (!state) state = createState()
  return state
}
