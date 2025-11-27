<template>
  <main class="page">
    <section class="content">
      <header class="header">
        <h1>Bucket: {{ bucketName }}</h1>

        <NuxtLink to="/" class="btn btn-small btn-back">
          ← Back
        </NuxtLink>
      </header>

      <p class="hint">
        เลือกไฟล์หรือโฟลเดอร์เพื่ออัปโหลด
      </p>

      <div class="upload-mode" style="margin-bottom:8px">
        <label style="margin-right:12px">
          <input type="radio" value="files" v-model="uploadMode" /> Upload files
        </label>
        <label>
          <input type="radio" value="folder" v-model="uploadMode" /> Upload folder
        </label>
      </div>

      <!-- Upload -->
      <form class="upload-form" @submit.prevent="handleUpload">
        <input
          v-if="uploadMode === 'folder'"
          ref="fileInput"
          name="files"
          type="file"
          class="file-input"
          multiple
          webkitdirectory
        />
        <input
          v-else
          ref="fileInput"
          name="files"
          type="file"
          class="file-input"
          multiple
        />

        <button
          class="btn btn-primary"
          type="submit"
          :disabled="uploading"
        >
          {{ uploading ? 'Uploading...' : 'Upload' }}
        </button>
      </form>

      <p v-if="uploadError" class="error">
        {{ uploadError }}
      </p>
    </section>

    <!-- Files -->
    <section class="content" style="margin-top: 24px">
      <h2>Files</h2>

      <div v-if="pendingFiles">Loading files...</div>
      <div v-else-if="errorFiles">{{ errorFiles }}</div>

      <table v-else class="table">
        <thead>
          <tr>
            <th>Key (Path)</th>
            <th>File Name</th>
            <th>Size (KB)</th>
            <th>Updated</th>
            <th style="width: 220px">Actions</th>
          </tr>
        </thead>

        <tbody>
          <tr v-if="!folders.length && !visibleFiles.length">
            <td colspan="5" class="empty">No files</td>
          </tr>

          <tr v-if="currentPath">
            <td colspan="5" class="empty">
              <button class="btn btn-small" type="button" @click="goUp">← Back</button>
              <strong style="margin-left:12px">{{ currentPath }}</strong>
            </td>
          </tr>

          <!-- folders -->
          <tr v-for="folder in folders" :key="'folder-'+folder">
            <td>{{ (currentPath ? currentPath + '/' : '') + folder + '/' }}</td>
            <td colspan="3">
              <button class="btn btn-small btn-primary" type="button" @click="enterFolder(folder)">
                Open
              </button>
              <button
                class="btn btn-small btn-danger"
                type="button"
                style="margin-left:8px"
                @click="deleteFolder(folder)"
              >
                Delete
              </button>
              <span style="margin-left:8px">{{ folder }}</span>
            </td>
            <td class="actions"></td>
          </tr>

          <!-- files -->
          <tr v-for="file in visibleFiles" :key="file.key">
            <td>{{ getDisplayName(file) }}</td>
            <td>
              <a :href="file.url" target="_blank" rel="noopener noreferrer">
                {{ getDisplayName(file) }}
              </a>
            </td>
            <td>{{ (file.size / 1024).toFixed(1) }}</td>
            <td>{{ formatDate(file.mtime) }}</td>

            <td class="actions">
              <button class="btn btn-small btn-success" type="button" @click="downloadFile(file)">
                Download
              </button>

              <button
                v-if="file.canShare"
                class="btn btn-small btn-primary"
                type="button"
                @click="copyLink(file)"
              >
                Share
              </button>

              <button
                v-if="file.canDelete"
                class="btn btn-small btn-danger"
                type="button"
                @click="deleteFile(file)"
              >
                Delete
              </button>
            </td>
          </tr>

        </tbody>
      </table>
    </section>
  </main>
</template>

<script setup lang="ts">
// แสดงรายการไฟล์ใน bucket และอนุญาตอัปโหลด/ดาวน์โหลด/ลบ (ใช้ middleware auth)
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from '#imports'
import '~/assets/css/minio.css'

definePageMeta({
  middleware: 'auth',
  ssr: false,    // 🔥 ปิด SSR เพื่อป้องกัน token หาย
})

/* composables */
const api = useApi()
const auth = useAuth()

/* route helpers */
const route = useRoute()
const router = useRouter()
const bucketName = computed(() => route.params.bucket as string)
const currentPath = computed(() => (route.query.path as string) ?? '')

/* ---------- load files ---------- */
type FileItem = {
  key: string
  size: number
  mtime: string | Date
  url: string
  name?: string
  ownerId: string | null
  ownerName: string | null
  ownerRole: string | null
  isOwner: boolean
  canDelete: boolean
  canShare: boolean
}

const files = ref<FileItem[]>([])
const pendingFiles = ref(false)
const errorFiles = ref<string | null>(null)

const refreshFiles = async () => {
  pendingFiles.value = true
  errorFiles.value = null

  try {
    const res = (await api.get(
      `/api/bucket/${encodeURIComponent(bucketName.value)}/files`
    )) as { items: FileItem[] }
    files.value = res.items
  } catch (err: any) {
    errorFiles.value = err?.data?.message || err?.message || 'Failed to load files'
  } finally {
    pendingFiles.value = false
  }
}

onMounted(async () => {
  auth.initAuth()
  await refreshFiles()
})

/* ---------- folder logic ---------- */
const prefixFor = (p: string) => (p ? p + '/' : '')

const folders = computed(() => {
  const set = new Set<string>()
  const prefix = prefixFor(currentPath.value)

  for (const f of files.value) {
    const key = f.key
    if (!key.startsWith(prefix)) continue
    const rest = key.slice(prefix.length)
    if (!rest) continue

    const parts = rest.split('/')
    if (parts.length > 1) {
      const folderName = parts[0]
      if (folderName) {
        set.add(folderName)
      }
    }
  }

  return Array.from(set).sort()
})

const visibleFiles = computed(() => {
  const prefix = prefixFor(currentPath.value)
  return files.value.filter((f) => {
    const key = f.key
    if (!key.startsWith(prefix)) return false
    const rest = key.slice(prefix.length)
    return rest.length > 0 && !rest.includes('/')
  })
})

const parentPath = computed(() => {
  if (!currentPath.value) return ''
  const parts = currentPath.value.split('/')
  parts.pop()
  return parts.join('/')
})

const getDisplayName = (file: FileItem) => {
  const prefix = prefixFor(currentPath.value)
  return file.key.startsWith(prefix) ? file.key.slice(prefix.length) : file.key
}

/* ---------- upload ---------- */
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const uploadError = ref<string | null>(null)
const uploadMode = ref<'files' | 'folder'>('folder')

const handleUpload = async () => {
  const input = fileInput.value
  if (!input?.files?.length) {
    uploadError.value = 'Please choose files or a folder'
    return
  }

  const formData = new FormData()

  for (const raw of Array.from(input.files)) {
    const file = raw as File & { webkitRelativePath?: string }
    const relative =
      file.webkitRelativePath && file.webkitRelativePath.length > 0
        ? file.webkitRelativePath
        : file.name

    formData.append('files', file, relative)
  }

  uploading.value = true
  uploadError.value = null

  try {
    await api.post(`/api/bucket/${encodeURIComponent(bucketName.value)}/files`, formData)
    input.value = ''
    await refreshFiles()
  } catch (err: any) {
    uploadError.value = err?.data?.message || 'Upload failed'
  } finally {
    uploading.value = false
  }
}

/* ---------- delete file ---------- */
const deleteFile = async (file: FileItem) => {
  if (!file.canDelete) {
    alert('You cannot delete this file')
    return
  }
  const key = file.key
  if (!confirm(`Delete ${key}?`)) return

  try {
    await api.delete(
      `/api/bucket/${encodeURIComponent(bucketName.value)}/key?key=${encodeURIComponent(key)}`
    )
    await refreshFiles()
  } catch (err: any) {
    alert(err?.data?.message || 'Delete failed')
  }
}

/* ---------- delete folder ---------- */
// calls backend folder.delete to remove every file in the prefix; backend enforces ownership/admin rights
const deleteFolder = async (folder: string) => {
  const prefix = `${prefixFor(currentPath.value)}${folder}/`
  if (!confirm(`Delete folder "${prefix}"?`)) return

  try {
    await api.delete(
      `/api/bucket/${encodeURIComponent(bucketName.value)}/folder?prefix=${encodeURIComponent(prefix)}`
    )
    await refreshFiles()
  } catch (err: any) {
    alert(err?.data?.message || 'Delete folder failed')
  }
}

/* ---------- download ---------- */
const downloadFile = (file: FileItem) => {
  const key = encodeURIComponent(file.key)
  const a = document.createElement('a')
  a.href = `/api/bucket/${encodeURIComponent(bucketName.value)}/object?key=${key}`
  a.download = getDisplayName(file)
  a.click()
}

/* ---------- share link ---------- */
const copyLink = async (file: FileItem) => {
  if (!file.canShare) {
    alert('You cannot share this file')
    return
  }
  const link = `${window.location.origin}/api/bucket/${encodeURIComponent(
    bucketName.value
  )}/object?key=${encodeURIComponent(file.key)}`
  await navigator.clipboard.writeText(link)
  alert('Copied:\n' + link)
}

/* ---------- folder navigation ---------- */
const enterFolder = (name: string) => {
  const newPath = currentPath.value ? currentPath.value + '/' + name : name
  router.push({ query: { path: newPath } })
}

const goUp = () => {
  const newPath = parentPath.value
  if (newPath) router.push({ query: { path: newPath } })
  else router.push({ query: {} })
}

/* ---------- date format ---------- */
const formatDate = (x: string | Date) => new Date(x).toLocaleString()
</script>
