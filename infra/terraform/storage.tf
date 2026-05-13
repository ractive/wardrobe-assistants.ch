// Storage zones.
//   - homepage:        serves the static homepage build artefacts (live)
//   - terraform_state: holds the OpenTofu remote state file (created during iter-11)
//   - admin_static:    holds the admin app's `_next/static/` chunks. The
//                      admin pull-zone routes `/_next/static/*` requests to
//                      this zone via `bunnynet_pullzone_edgerule.admin_static_assets`
//                      (iter-41 §F). Uploads are additive (`remove: false`) so
//                      older container instances can still resolve their
//                      chunks during a rolling deploy.

resource "bunnynet_storage_zone" "homepage" {
  name      = "wardrobe-assistants-ch-homepage"
  region    = "DE"
  zone_tier = "Standard"

  lifecycle {
    prevent_destroy = true
  }
}

resource "bunnynet_storage_zone" "terraform_state" {
  name      = "wardrobe-assistants-terraform-state"
  region    = "DE"
  zone_tier = "Standard"

  lifecycle {
    prevent_destroy = true
  }
}

resource "bunnynet_storage_zone" "admin_static" {
  name      = "wardrobe-assistants-admin-static"
  region    = "DE"
  zone_tier = "Standard"

  lifecycle {
    prevent_destroy = true
  }
}
