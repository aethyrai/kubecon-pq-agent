---
title: CRD schema change
description: A CRD schema change must regenerate the TypeScript types and update operator tests
type: check
when: PRs that modify any file under deploy/crds/ or the CRD zod specs in packages/schema/
actions: Verify generated types and operator tests were updated; request changes if not
---

The three CRDs are `CryptoPolicy`, `PQTunnel`, and `PQPeer` in group `aethyr.io/v1alpha1`. When a PR
changes one of them:

- Check that the TypeScript types in `packages/schema/` were regenerated from the same source, so the
  OpenAPI schema in `deploy/crds/` and the zod spec agree field by field.
- Check that `apps/aethyr-operator/` tests cover the new or changed field, including the render of the
  gateway ConfigMap from `CryptoPolicy` and `PQTunnel`.
- Check that OpenAPI validation still rejects `kem: ML-KEM-512` and still accepts `ML-KEM-768` and
  `ML-KEM-1024`.
- Request changes if the types or the tests are stale.
