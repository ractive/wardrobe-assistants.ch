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

// `cache_enabled = true` and `strip_cookies = false` match live state and
// the MC controller's defaults. The admin app is responsible for setting
// `Cache-Control: no-store, private` on every authenticated response so
// the bunny CDN never caches a Set-Cookie or session-bearing body. Verify
// during audit; if Better Auth ever drops that header, flip strip_cookies
// to true here and add an edge rule that bypasses cache for requests with
// a `Cookie:` header.
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
