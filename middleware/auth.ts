export default defineNuxtRouteMiddleware((to, from) => {
  // Skip auth check on server (SSR) to avoid hydration mismatch
  // Client-side auth check will happen after plugin initialization
  if (!process.client) {
    return
  }

  const { isAuthenticated, initAuth } = useAuth()

  initAuth()

  // Allow access to login page without authentication
  if (to.path === '/login') {
    if (isAuthenticated.value) {
      return navigateTo('/')
    }
    return
  }

  // Protect all other routes
  if (!isAuthenticated.value) {
    return navigateTo('/login')
  }
})
