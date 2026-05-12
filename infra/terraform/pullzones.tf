// Pull zones + custom hostnames.
//
//   - homepage  (id 5798479): origin = homepage storage zone, fronts apex + www
//   - admin_cdn (id 5798594): MC-managed pull zone fronting the admin Magic Container.
//                             Origin block is owned by the MC controller; we
//                             ignore_changes = [origin] to avoid drift on every
//                             container redeploy.

resource "bunnynet_pullzone" "homepage" {
  name                  = "wardrobe-assistants-ch"
  cache_enabled         = false
  cache_chunked         = true
  cache_expiration_time = 2592000

  origin {
    type        = "StorageZone"
    storagezone = bunnynet_storage_zone.homepage.id
  }

  routing {}

  lifecycle {
    prevent_destroy = true
  }
}

resource "bunnynet_pullzone_hostname" "homepage_apex" {
  pullzone    = bunnynet_pullzone.homepage.id
  name        = "wardrobe-assistants.ch"
  force_ssl   = true
  tls_enabled = true

  lifecycle {
    prevent_destroy = true
  }
}

resource "bunnynet_pullzone_hostname" "homepage_www" {
  pullzone    = bunnynet_pullzone.homepage.id
  name        = "www.wardrobe-assistants.ch"
  force_ssl   = true
  tls_enabled = true

  lifecycle {
    prevent_destroy = true
  }
}

// Admin pull-zone caching posture (revised 2026-05-12, audit C-SEC-04):
//   - `cache_enabled = true` matches live state and the MC controller's
//     defaults.
//   - `strip_cookies = false` — the iter-16b flip to `true` unintentionally
//     stripped *every* `Set-Cookie` response header at the edge (the bunny
//     setting is unconditional, not "only on cached responses"), which
//     broke Better Auth login: the 200 OK reached the browser without the
//     session cookie. The earlier comment promised an accompanying edge
//     rule to "bypass cache for cookie-bearing requests" but that half
//     never landed.
//   The defense against caching authenticated bodies now relies on the
//   app emitting `Cache-Control: private, no-store, must-revalidate` via
//   `apps/admin/next.config.ts`'s `headers()` block. If you ever see a
//   Set-Cookie response leak through with a cacheable Cache-Control,
//   fix it at the origin (route handler / Better Auth response shape) —
//   do *not* re-enable `strip_cookies` here without first adding the
//   companion edge rule that varies the cache key on cookies.
// The admin pull-zone serves only authenticated traffic; there is no public
// surface that depends on cookie-bearing cache hits.
resource "bunnynet_pullzone" "admin_cdn" {
  name          = "mc-r6f39iacv2"
  cache_enabled = true
  strip_cookies = false

  origin {
    type                  = "ComputeContainer"
    container_app_id      = var.admin_container_app_id
    container_endpoint_id = "h4vme6Uhod4W3Yu-admin-cdn-SBfPZ5UIiZ"
    // The endpoint id rotates on container redeploy; ignore_changes
    // = [origin] (below) keeps OpenTofu from chasing it.
  }

  routing {}

  lifecycle {
    // Container endpoint id rotates on redeploy; the MC controller owns this block.
    ignore_changes  = [origin]
    prevent_destroy = true
  }
}

resource "bunnynet_pullzone_hostname" "admin_cdn" {
  pullzone    = bunnynet_pullzone.admin_cdn.id
  name        = "admin.wardrobe-assistants.ch"
  force_ssl   = true
  tls_enabled = true

  lifecycle {
    prevent_destroy = true
  }
}
