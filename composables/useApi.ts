export const useApi = () => {
  const auth = useAuth()
  const { accessToken, refreshAccessToken, logout } = auth

  const request = async (url: string, options: any = {}) => {
    const headers: Record<string, string> = { ...(options.headers || {}) }

    // If we don't have an access token in memory, try to refresh using the cookie before the first call
    if (!accessToken.value) {
      await refreshAccessToken().catch(() => {})
    }

    if (accessToken.value) {
      headers.Authorization = `Bearer ${accessToken.value}`
    }
    try {
      return await $fetch(url, {
        ...options,
        credentials: "include",
        headers
      })
    } catch (err: any) {
      if (err?.status === 401) {
        const ok = await refreshAccessToken()
        if (!ok) {
          logout()
          throw err
        }

        headers.Authorization = `Bearer ${accessToken.value}`

        return await $fetch(url, {
          ...options,
          credentials: "include",
          headers
        })
      }

      throw err
    }
  }

  return {
    get: (url: string, options?: any) => request(url, { ...options, method: "GET" }),
    post: (url: string, body?: any, options?: any) =>
      request(url, { ...options, method: "POST", body }),
    put: (url: string, body?: any, options?: any) =>
      request(url, { ...options, method: "PUT", body }),
    delete: (url: string, options?: any) =>
      request(url, { ...options, method: "DELETE" }),
  }
}
