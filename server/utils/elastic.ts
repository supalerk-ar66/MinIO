import { Client } from '@elastic/elasticsearch'

const FILES_INDEX = 'files'
const FILE_PIPELINE_ID = 'file-attachment'

const config = useRuntimeConfig()

export const esClient = new Client({
  node: config.elasticNode || process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
})

export async function ensureElasticSetup() {
  await ensurePipeline()
  await ensureIndex()
}

async function ensurePipeline() {
  try {
    await esClient.ingest.getPipeline({ id: FILE_PIPELINE_ID })
    return
  } catch (err) {
    // fallthrough to create
  }

  await esClient.ingest.putPipeline({
    id: FILE_PIPELINE_ID,
    body: {
      description: 'Extract file contents via ingest-attachment',
      processors: [
        {
          attachment: {
            field: 'data',
            target_field: 'attachment',
            indexed_chars: -1,
            properties: ['content', 'title', 'language', 'author', 'content_type'],
          },
        },
        {
          remove: {
            field: 'data',
            ignore_missing: true,
          },
        },
      ],
    },
  })
}

async function ensureIndex() {
  const exists = await esClient.indices.exists({ index: FILES_INDEX })
  if (exists) return

  await esClient.indices.create({
    index: FILES_INDEX,
    body: {
      settings: {
        analysis: {
          analyzer: {
            default: {
              type: 'standard',
            },
          },
        },
      },
      mappings: {
        dynamic: false,
        properties: {
          bucket: { type: 'keyword' },
          key: { type: 'keyword' },
          path: { type: 'keyword' },
          filename: { type: 'keyword' },
          ownerId: { type: 'keyword' },
          size: { type: 'long' },
          extension: { type: 'keyword' },
          updatedAt: { type: 'date' },
          attachment: {
            properties: {
              content: { type: 'text' },
              title: { type: 'text' },
              language: { type: 'keyword' },
              author: { type: 'text' },
              content_type: { type: 'keyword' },
            },
          },
        },
      },
    },
  })
}

export { FILES_INDEX, FILE_PIPELINE_ID }
