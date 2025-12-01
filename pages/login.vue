<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1>MinIO</h1>
        <p>Login to your account</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="username">Username</label>
          <input
            id="username"
            v-model="form.username"
            type="text"
            placeholder="admin or user"
            required
            :disabled="isLoading"
          />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            placeholder="password"
            required
            :disabled="isLoading"
          />
        </div>

        <button
          type="submit"
          class="btn btn-primary btn-block"
          :disabled="isLoading"
        >
          {{ isLoading ? 'Logging in...' : 'Login' }}
        </button>
      </form>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <!-- <div class="login-footer">
        <p>Demo Credentials:</p>
        <ul>
          <li><strong>Admin:</strong> admin / admin123</li>
          <li><strong>User:</strong> user / user123</li>
          <li><strong>User2:</strong> user2/ user2123</li>
        </ul>
      </div> -->
    </div>
  </div>
</template>

<script setup lang="ts">
/*
  🔥 SCRIPT ใหม่ (แก้เฉพาะโค้ด logic)
  - ไม่แตะ template เดิม
  - ปิด SSR
  - ป้องกัน redirect ลูป
  - รวมกับ useAuth ใหม่ของคุณได้จริง
*/

import { ref } from 'vue'
import { useRouter } from '#app'
import '~/assets/css/login.css'

definePageMeta({
  middleware: 'auth', // ให้ middleware ตรวจ login
  layout: false,
  ssr: false,         // ❗ สำคัญ! ป้องกัน token หายบน SSR
})

const router = useRouter()

// ดึง reactive state จาก useAuth()
const { login, isLoading, error, initAuth, isAuthenticated } = useAuth()


const form = ref({
  username: '',
  password: '',
})

/* ---------- Login Function ---------- */
const handleLogin = async () => {
  // เรียกฟังก์ชัน login ของคุณ → ใช้ JWT + refresh token
  const ok = await login(form.value.username, form.value.password)

  if (ok) {
    // redirect เฉพาะถ้ายังไม่ login (ป้องกัน loop)
    if (isAuthenticated.value) {
      router.push('/')
    }
  }
}
</script>
