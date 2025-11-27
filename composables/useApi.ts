export const useApi = () => {
  const auth = useAuth()
  const { accessToken, refreshAccessToken, logout } = auth

  const request = async (url: string, options: any = {}) => {
    const headers: Record<string, string> = { ...(options.headers || {}) }
    const hadToken = !!accessToken.value // track whether this call actually sent a token

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
      if (err?.status === 401 && hadToken) {
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
