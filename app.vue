<template>
  <div id="app-wrapper">
    <!-- ถ้าเป็นหน้า login → ไม่ต้องโชว์ layout -->
    <NuxtPage v-if="$route.path === '/login'" />

    <!-- ส่วนอื่นใช้ Dashboard Layout -->
    <ClientOnly v-else>
      <div id="app-dashboard" class="dashboard-layout">

        <!-- SIDEBAR -->
        <aside class="sidebar">
          <div class="brand">🗂️ MinIO</div>

          <nav class="nav">
            <NuxtLink to="/" class="nav-item" exact-active-class="active">
              📦 Buckets
            </NuxtLink>

            <NuxtLink to="/search" class="nav-item" active-class="active">
              🔍 Search
            </NuxtLink>

            <NuxtLink to="/profile" class="nav-item" active-class="active">
              👥 Profile
            </NuxtLink>
          </nav>

          <div class="sidebar-footer">
            <div class="user-info">
              <p v-if="username" class="username">{{ username }}</p>
              <p v-if="role" class="role">{{ role }}</p>
            </div>

            <button @click="handleLogout" class="btn btn-small btn-danger">
              Logout
            </button>
          </div>
        </aside>

        <!-- MAIN CONTENT -->
        <div class="main">

          <!-- TOPBAR -->
          <header class="topbar">
            <div class="topbar-left">
              <button class="btn btn-small" @click="refreshPage">
                🔄 Refresh
              </button>
            </div>

            <div class="topbar-center">
              <h2>{{ pageTitle }}</h2>
            </div>

            <div class="topbar-right">
              <span class="status">✓ Ready</span>
              <button class="btn btn-small btn-danger" @click="handleLogout" style="margin-left:12px">
                Logout
              </button>
            </div>
          </header>

          <!-- CONTENT AREA -->
          <main class="content-area">
            <NuxtPage />
          </main>

        </div>
      </div>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
/*
  🔥 FIX สำคัญ:
  - ปิด SSR เพื่อป้องกัน token หายตอนโหลดครั้งแรก
  - โหลด auth.initAuth() ก่อน render layout
  - fetchUser() หากโหลด token แต่ user ไม่มี
  - ป้องกัน flash หน้า (เช่น username undefined)
*/

import { onMounted, computed, ref } from 'vue'
import { useRouter, useRoute } from '#app'
import '~/assets/css/app-layout.css'

const router = useRouter()
const route = useRoute()
const auth = useAuth()

// ดึงค่าจาก auth state
const username = computed(() => auth.user?.value?.username ?? '')
const role = computed(() => auth.user?.value?.role ?? '')

// ชื่อหน้า (โชว์บน topbar)
const pageTitle = computed(() => {
  if (route.path === '/') return '📦 Buckets'
  if (route.path.startsWith('/search')) return '🔍 Search'
  if (route.path.includes('bucket')) return '📂 Files'
  if (route.path.includes('profile')) return '👥 Profile'
  return 'Dashboard'
})

// โหลด auth state ตอนเปิด app
onMounted(async () => {
  auth.initAuth()

  // ถ้า token มีแต่ user ยังไม่โหลด → ดึงจาก /api/auth/me
  if (auth.accessToken?.value && !auth.user?.value) {
    await auth.fetchUser()
  }
})

// Logout
const handleLogout = () => {
  auth.logout()
  router.push('/login')
}

// Refresh หน้าแบบ hard reload
const refreshPage = () => {
  window.location.reload()
}
</script>
