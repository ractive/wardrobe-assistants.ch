terraform {
  required_version = ">= 1.9"

  required_providers {
    bunnynet = {
      source = "BunnyWay/bunnynet"
      // Pin patch-only — the provider is pre-1.0 and minor bumps (0.13 → 0.14)
      // ship breaking schema changes. Review the changelog before bumping.
      version = "~> 0.14.0"
    }
  }

  // HTTP backend → bunny `wardrobe-assistants-terraform-state` storage zone.
  // Auth: `AccessKey` HTTP header, value = the storage-zone password
  // (TERRAFORM_STATE_STORAGE_KEY in .env.local). Pass at init time via:
  //
  //   tofu init -backend-config=<temp HCL with `headers = { AccessKey = "..." }`>
  //
  // See kb/iac-runbook.md for the full per-shell init recipe.
  // `-lock=false` is required everywhere because bunny returns HTTP 201 on
  // PUT (vs the 200 OpenTofu's `http` backend expects for lock acquisition).
  backend "http" {
    address        = "https://storage.bunnycdn.com/wardrobe-assistants-terraform-state/wardrobe-assistants.ch/terraform.tfstate"
    update_method  = "PUT"
    lock_address   = "https://storage.bunnycdn.com/wardrobe-assistants-terraform-state/wardrobe-assistants.ch/terraform.tfstate.lock"
    lock_method    = "PUT"
    unlock_address = "https://storage.bunnycdn.com/wardrobe-assistants-terraform-state/wardrobe-assistants.ch/terraform.tfstate.lock"
    unlock_method  = "DELETE"
  }
}

provider "bunnynet" {
  api_key = var.bunny_api_key
}
