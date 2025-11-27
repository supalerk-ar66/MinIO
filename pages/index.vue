<template>
  <main class="page">
    <section class="content">
      <!-- Admin-only create bucket form -->
      <h1>MinIO</h1>

      <template v-if="isAdmin">
        <div class="create-box">
          <input
            v-model="newBucket"
            type="text"
            class="bucket-input"
            placeholder="ชื่อ bucket"
          />
          <button
            class="btn btn-primary"
            type="button"
            @click="handleCreate"
            :disabled="creating"
          >
            {{ creating ? 'Creating...' : 'Create Bucket' }}
          </button>
        </div>

        <p v-if="createError" class="error">{{ createError }}</p>
      </template>
    </section>

    <section class="content" style="margin-top: 24px">
      <div class="header-row">
        <h2>Buckets</h2>
        <p v-if="!isAdmin" class="hint">
          ดูรายชื่อ bucket และเปิดเพื่ออัปโหลด/ดาวน์โหลดไฟล์ของคุณ
        </p>
      </div>

      <div v-if="pendingBuckets">Loading buckets...</div>
      <div v-else-if="errorBuckets">{{ errorBuckets }}</div>

      <table v-else class="table">
        <!-- show same table to both roles; buttons gated by isAdmin -->
        <thead>
          <tr>
            <th>Name</th>
            <th style="width: 240px">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!buckets.length">
            <td colspan="2" class="empty">No buckets</td>
          </tr>

          <tr v-for="name in buckets" :key="name">
            <td>{{ name }}</td>

            <td class="actions">
              <NuxtLink
                :to="`/bucket/${encodeURIComponent(name)}`"
                class="btn btn-small btn-primary"
              >
                Open
              </NuxtLink>

              <template v-if="isAdmin">
                <button
                  class="btn btn-small btn-success"
                  type="button"
                  @click="downloadBucket(name)"
                >
                  Download
                </button>

                <button
                  class="btn btn-small btn-danger"
                  type="button"
                  @click="handleDelete(name)"
                >
                  Delete
                </button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- <section v-if="!isAdmin" class="content" style="margin-top: 24px">
      <h2>Open Bucket by Name</h2>
      <div class="create-box">
        <input
          v-model="manualBucket"
          type="text"
          class="bucket-input"
          placeholder="ชื่อ bucket ที่ได้รับสิทธิ์"
        />
        <button class="btn btn-primary" type="button" @click="openManualBucket">
          Open Bucket
        </button>
      </div>
      <p v-if="manualError" class="error">{{ manualError }}</p>
      <p class="hint">
        กรอกชื่อ bucket ที่ admin สร้างไว้ (ตัวพิมพ์เล็ก, a-z 0-9 . -) เพื่ออัปโหลด/ดาวน์โหลดไฟล์ตามสิทธิ์ของคุณ
      </p>
    </section> -->
  </main>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import '~/assets/css/minio.css'

// หน้า dashboard หลัก: ใช้ auth middleware และปิด SSR เพื่อเลี่ยงปัญหา token หาย
definePageMeta({
  middleware: 'auth',
  ssr: false,
})

/** ---------- โหลด bucket list (protected) ---------- **/
type BucketsResponse = {
  buckets: string[]
}

const auth = useAuth()
const api = useApi()
const router = useRouter()

const isAdmin = computed(() => auth.user?.value?.role === 'admin')

const bucketsData = ref<BucketsResponse | null>(null)
const pendingBuckets = ref(false)
const errorBuckets = ref<string | null>(null)
const manualBucket = ref('')
const manualError = ref<string | null>(null)
const bucketNameRegex = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/

// choose backend endpoint based on role (user endpoint avoids hitting admin-only API)
const bucketEndpoint = computed(() => (isAdmin.value ? '/api/bucket' : '/api/bucket/list'))
const buckets = computed(() => bucketsData.value?.buckets ?? [])

// ดึงรายการ bucket เฉพาะเมื่อเป็น admin (user ทั่วไปให้เปิด manual bucket แทน)
const refreshBuckets = async () => {
  pendingBuckets.value = true
  errorBuckets.value = null

  try {
    const data = (await api.get(bucketEndpoint.value)) as BucketsResponse
    bucketsData.value = data
  } catch (err: any) {
    errorBuckets.value = err?.data?.message || err?.message || 'Failed to load buckets'
  } finally {
    pendingBuckets.value = false
  }
}

onMounted(async () => {
  auth.initAuth()
  await refreshBuckets()
})

watch(
  bucketEndpoint,
  async () => {
    // whenever role changes (admin<->user) refetch using the appropriate endpoint
    await refreshBuckets()
  },
  { immediate: false }
)

/** ---------- สร้าง bucket ใหม่ ---------- **/
const newBucket = ref('')
const creating = ref(false)
const createError = ref<string | null>(null)

const handleCreate = async () => {
  if (!isAdmin.value) {
    createError.value = 'Only admins can create buckets'
    return
  }

  const name = newBucket.value.trim().toLowerCase()
  if (!name) {
    createError.value = 'กรุณากรอกชื่อ bucket'
    return
  }
  if (!bucketNameRegex.test(name)) {
    createError.value =
      'ชื่อ bucket ต้องเป็น a-z, 0-9, . หรือ - ความยาว 3-63 ตัว และขึ้น/ลงท้ายด้วยตัวอักษรหรือตัวเลข'
    return
  }

  creating.value = true
  createError.value = null

  try {
    await api.post('/api/bucket/create', { name })
    newBucket.value = ''
    await refreshBuckets()
  } catch (err: any) {
    createError.value = err?.data?.message || err?.message || 'Create bucket failed'
  } finally {
    creating.value = false
  }
}

/** ---------- ลบ bucket ---------- **/
const handleDelete = async (name: string) => {
  if (!isAdmin.value) return
  if (!confirm(`Delete bucket "${name}" ?`)) return

  try {
    await api.delete(`/api/bucket/${encodeURIComponent(name)}`)
    await refreshBuckets()
  } catch (err: any) {
    alert(err?.data?.message || err?.message || 'Delete bucket failed')
  }
}

/** ---------- ดาวน์โหลดทั้ง bucket (zip) ---------- **/
const downloadBucket = (name: string) => {
  if (!isAdmin.value) return
  const url = `/api/bucket/${encodeURIComponent(name)}/download`
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}.zip`
  a.click()
}

// ผู้ใช้ทั่วไปกรอกชื่อ bucket ที่ได้รับสิทธิ์แล้ว redirect ไปยังหน้าจัดการไฟล์
const openManualBucket = () => {
  manualError.value = null
  const raw = manualBucket.value.trim().toLowerCase()
  if (!raw) {
    manualError.value = 'กรุณากรอกชื่อ bucket'
    return
  }
  if (!bucketNameRegex.test(raw)) {
    manualError.value = 'ชื่อ bucket ต้องเป็นตัวพิมพ์เล็ก ความยาว 3-63 ตัว และใช้ a-z, 0-9, . หรือ - เท่านั้น'
    return
  }
  manualBucket.value = raw
  router.push(`/bucket/${encodeURIComponent(raw)}`)
}
</script>
