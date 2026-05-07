// Storage zones.
//   - homepage:        serves the static homepage build artefacts (live)
//   - terraform_state: holds the OpenTofu remote state file (created during iter-11)

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
