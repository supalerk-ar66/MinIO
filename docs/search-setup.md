# Search Engine Stack Setup

This project now uses **MinIO + Elasticsearch + Kibana** to index and search every uploaded object. Follow this guide to bring up the stack and create the required ingest pipeline and index mapping.

## 1. Start Docker services

```bash
docker-compose up -d minio elasticsearch kibana
```

- MinIO console: http://localhost:9001 (user/pass: `minioadmin` / `minioadmin`)
- Elasticsearch: http://localhost:9200
- Kibana DevTools: http://localhost:5601

> Running inside a nested virtualization / LXD environment? Compose may fail to read AppArmor profiles. In that case add `security_opt: [apparmor:unconfined]` to each service (already included in the provided compose file) or run Docker on the host directly.

> The Elasticsearch container uses `docker.elastic.co/elasticsearch/elasticsearch:8.13.4`, which already includes the `ingest-attachment` plugin.

## 2. Create the ingest pipeline (`file-attachment`)

You can execute the following either via `curl` or Kibana DevTools.

### cURL

```bash
curl -X PUT http://localhost:9200/_ingest/pipeline/file-attachment \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Extract text from uploaded files",
    "processors": [
      {
        "attachment": {
          "field": "data",
          "target_field": "attachment",
          "indexed_chars": -1
        }
      },
      { "set": { "field": "content", "value": "{{{attachment.content}}}" } },
      { "set": { "field": "title", "value": "{{{attachment.title}}}" } },
      { "set": { "field": "language", "value": "{{{attachment.language}}}" } },
      { "set": { "field": "author", "value": "{{{attachment.author}}}" } },
      { "remove": { "field": "attachment" } }
    ]
  }'
```

### Kibana DevTools

```http
PUT _ingest/pipeline/file-attachment
{
  "description": "Extract text from uploaded files",
  "processors": [
    {
      "attachment": {
        "field": "data",
        "target_field": "attachment",
        "indexed_chars": -1
      }
    },
    { "set": { "field": "content", "value": "{{{attachment.content}}}" } },
    { "set": { "field": "title", "value": "{{{attachment.title}}}" } },
    { "set": { "field": "language", "value": "{{{attachment.language}}}" } },
    { "set": { "field": "author", "value": "{{{attachment.author}}}" } },
    { "remove": { "field": "attachment" } }
  ]
}
```

The pipeline expects a document with a Base64 field named `data` and stores the extracted text in the `content` field.

## 3. Create the `files` index with mapping

```bash
curl -X PUT http://localhost:9200/files \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "analysis": {
        "analyzer": {
          "default": { "type": "standard" }
        }
      }
    },
    "mappings": {
      "dynamic_templates": [
        {
          "metadata_fields": {
            "path_match": "metadata.*",
            "mapping": {
              "type": "text",
              "fields": { "keyword": { "type": "keyword" } }
            }
          }
        }
      ],
      "properties": {
        "bucket": { "type": "keyword" },
        "key": { "type": "keyword" },
        "fileName": {
          "type": "text",
          "fields": { "keyword": { "type": "keyword" } }
        },
        "size": { "type": "long" },
        "ownerId": { "type": "keyword" },
        "mime": { "type": "keyword" },
        "content": { "type": "text" },
        "title": { "type": "text" },
        "language": { "type": "keyword" },
        "author": { "type": "keyword" },
        "metadata": { "type": "object" },
        "updatedAt": { "type": "date" }
      }
    }
  }'
```

### Kibana DevTools equivalent

```http
PUT files
{
  "settings": {
    "analysis": {
      "analyzer": {
        "default": { "type": "standard" }
      }
    }
  },
  "mappings": {
    "dynamic_templates": [
      {
        "metadata_fields": {
          "path_match": "metadata.*",
          "mapping": {
            "type": "text",
            "fields": { "keyword": { "type": "keyword" } }
          }
        }
      }
    ],
    "properties": {
      "bucket": { "type": "keyword" },
      "key": { "type": "keyword" },
      "fileName": {
        "type": "text",
        "fields": { "keyword": { "type": "keyword" } }
      },
      "size": { "type": "long" },
      "ownerId": { "type": "keyword" },
      "mime": { "type": "keyword" },
      "content": { "type": "text" },
      "title": { "type": "text" },
      "language": { "type": "keyword" },
      "author": { "type": "keyword" },
      "metadata": { "type": "object" },
      "updatedAt": { "type": "date" }
    }
  }
}
```

## 4. Verification

1. `curl http://localhost:9200/_cat/indices?v` → confirm the `files` index exists.
2. `curl http://localhost:9200/_ingest/pipeline/file-attachment` → confirm pipeline definition.
3. Upload a test document through MinIO and verify that the webhook (implemented in later steps) indexes it.

You can now proceed to implement the webhook receiver and search API.
