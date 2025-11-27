<template>
  <div class="profile-container">
    <div class="profile-card">

      <div class="profile-header">
        <div class="avatar">👤</div>
        <h1>{{ user?.username || 'User' }}</h1>

        <p class="role-badge" :class="user?.role">{{ user?.role }}</p>
      </div>

      <div class="profile-body">
        <div class="info-section">
          <h2>User Information</h2>

          <div class="info-grid">
            <div class="info-item">
              <label>Username</label>
              <p>{{ user?.username }}</p>
            </div>

            <div class="info-item">
              <label>Email</label>
              <p>{{ user?.email }}</p>
            </div>

            <div class="info-item">
              <label>Role</label>
              <p class="role-text" :class="user?.role">{{ user?.role }}</p>
            </div>

            <div class="info-item">
              <label>Member Since</label>
              <p>{{ formatDate(user?.createdAt) }}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/*
  🔥 script ใหม่
  - ใช้ auth.fetchUser() ดึงข้อมูลจาก Backend จริง
  - ปิด SSR (เพื่อไม่ให้ token หาย)
  - ให้ profile ทำงานถูกต้องแม้ refresh หน้า
*/

import { computed, onMounted } from 'vue'
import '~/assets/css/profile.css'

definePageMeta({
  middleware: 'auth',
  ssr: false,    // ป้องกัน SSR ทำ token หาย
})

const auth = useAuth()

// ดึงค่า user จาก state
const user = computed(() => auth.user?.value)

// format วันที่
const formatDate = (dateString: string | undefined) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// โหลดข้อมูลผู้ใช้เมื่อเปิดหน้า
onMounted(async () => {
  auth.initAuth()

  // ถ้า user ไม่มี หรือเป็น null
  if (!auth.user?.value) {
    await auth.fetchUser()
  }
})
</script>
