<template>
  <main class="page">
    <section class="content">
      <div class="header-row">
        <h1>Search Files</h1>
        <p class="hint">ค้นหาไฟล์จาก Elasticsearch (จำกัดตามสิทธิ์ของผู้ใช้)</p>
      </div>

      <div class="create-box" style="gap: 8px;">
        <input
          v-model="query"
          type="text"
          class="bucket-input"
          placeholder="ค้นหาด้วยชื่อไฟล์หรือข้อความในไฟล์"
          @keyup.enter="performSearch"
        />
        <button class="btn btn-primary" type="button" :disabled="pending" @click="performSearch">
          {{ pending ? 'Searching...' : 'Search' }}
        </button>
      </div>

      <div v-if="error" class="error">{{ error }}</div>

      <section class="content" style="margin-top: 16px">
        <div v-if="pending">Loading...</div>
        <div v-else-if="!items.length">No results</div>

        <table v-else class="table">
          <thead>
            <tr>
              <th>Filename</th>
              <th>Bucket / Path</th>
              <th>Updated</th>
              <th>Snippet</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id">
              <td>
                <a
                  href="#"
                  @click.prevent="openItem(item)"
                  v-html="highlightMatch(item.filename)"
                ></a>
              </td>
              <td>{{ item.bucket }} / {{ item.path }}</td>
              <td>{{ formatDate(item.updatedAt) }}</td>
              <td v-html="highlightMatch(item.snippet)"></td>
            </tr>
          </tbody>
        </table>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import '~/assets/css/minio.css'

definePageMeta({
  middleware: 'auth',
  ssr: false,
})

type SearchItem = {
  id: string
  bucket: string
  key: string
  filename: string
  updatedAt: string
  snippet: string
  path: string
}

const api = useApi()
const auth = useAuth()
const router = useRouter()

const query = ref('')
const pending = ref(false)
const error = ref<string | null>(null)
const items = ref<SearchItem[]>([])

const performSearch = async () => {
  pending.value = true
  error.value = null
  try {
    const res = (await api.get('/api/files/search', {
      query: { q: query.value },
    })) as { items: SearchItem[] }
    items.value = res.items
  } catch (err: any) {
    error.value = err?.data?.message || err?.message || 'Search failed'
  } finally {
    pending.value = false
  }
}

const openItem = (item: SearchItem) => {
  router.push({
    path: `/bucket/${encodeURIComponent(item.bucket)}`,
    query: { path: item.path },
  })
}

const formatDate = (x: string | Date) => new Date(x).toLocaleString()

const highlightMatch = (text: string) => {
  if (!text || !query.value.trim()) return text
  const escaped = query.value.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matcher = new RegExp(`(${escaped})`, 'gi')
  return text.replace(matcher, '<mark class="highlight">$1</mark>')
}

onMounted(() => {
  auth.initAuth()
})
</script>

<style scoped>
.highlight {
  background: #fff3bf;
  padding: 0 2px;
  border-radius: 2px;
}
</style>
