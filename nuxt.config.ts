// nuxt.config.ts
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  // Enable Nuxt DevTools only when explicitly requested via env var.
  // This avoids DevTools trying to register workspace/filesystem entries
  // which can produce console errors in some environments.
  devtools: { enabled: process.env.NUXT_DEVTOOLS === 'true' },

  // Runtime config for sensitive values
  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
    jwtExpiry: process.env.JWT_EXPIRY || '1h',
    refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
    // Use RSA keys if provided; otherwise fall back to shared secret for HS256 in dev
    jwtPrivateKeyPath:
      process.env.JWT_PRIVATE_KEY_PATH ||
      process.env.JWT_SECRET ||
      'dev-secret-key-change-in-production',
    jwtPublicKeyPath:
      process.env.JWT_PUBLIC_KEY_PATH ||
      process.env.JWT_SECRET ||
      'dev-secret-key-change-in-production',
    elasticNode: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
    minioWebhookSecret: process.env.MINIO_WEBHOOK_SECRET || '',
  },

  // Nitro compatibility
  nitro: {
    compatibilityDate: '2025-11-28'
  },

  app: {
    head: {
      title: 'Market App',
      meta: [
        {
          name: 'description',
          content: 'Simple Market fullstack app using Nuxt 4 + Docker'
        }
      ]
    }
  },

  typescript: {
    strict: true
  }
})
