export default defineNuxtPlugin(() => {
  if (!process.client) return
  
  const auth = useAuth()
  auth.initAuth()
})
