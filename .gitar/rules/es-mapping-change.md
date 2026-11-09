---
title: Elasticsearch mapping change
description: A mapping change must be reflected in the query layer and the ingest normalizer
type: check
when: PRs that add or modify index mappings under packages/es-client/ or alias definitions
actions: Verify the retriever and the normalizer were updated; request changes if not
---

When a PR changes an index mapping or an alias in `packages/es-client/`:

- Check that the hybrid retriever (BM25 + kNN with RRF) in `packages/es-client/` still references
  fields that exist in the new mapping, including `embedding` dimensions.
- Check that the normalizer in `apps/ingest/` writes every field the mapping declares and no field it
  does not.
- Check that the alias swap still points each alias at an index with the new mapping.
- If any of the three is missing, request changes and name the file that needs the update.
