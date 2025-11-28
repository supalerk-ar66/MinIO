import { defineEventHandler, getQuery, createError } from 'h3'
import { esClient, ensureElasticSetup, FILES_INDEX } from '~/server/utils/elastic'
import { requireAuth } from '~/server/middleware/auth'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const q = (getQuery(event).q as string | undefined) || ''

  await ensureElasticSetup()

  const must = q
    ? [
        {
          multi_match: {
            query: q,
            fields: ['filename^3', 'attachment.title^2', 'attachment.content'],
            fuzziness: 'AUTO',
          },
        },
      ]
    : [{ match_all: {} }]

  const filter =
    user.role === 'admin'
      ? []
      : [
          {
            term: { ownerId: user.sub },
          },
        ]

  const res = await esClient.search({
    index: FILES_INDEX,
    size: 20,
    query: {
      bool: {
        must,
        filter,
      },
    },
    highlight: {
      fields: {
        'attachment.content': { fragment_size: 120, number_of_fragments: 1 },
      },
    },
    _source: ['bucket', 'key', 'filename', 'ownerId', 'updatedAt', 'path', 'attachment'],
  })

  const items = res.hits.hits.map((hit: any) => {
    const source = hit._source || {}
    return {
      id: hit._id,
      bucket: source.bucket,
      key: source.key,
      filename: source.filename || source.key,
      updatedAt: source.updatedAt,
      snippet:
        hit.highlight?.['attachment.content']?.[0] ||
        source.attachment?.content?.slice(0, 200) ||
        '',
      path: source.path || source.key,
    }
  })

  return { items }
})
