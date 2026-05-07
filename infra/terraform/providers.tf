terraform {
  required_version = ">= 1.9"

  required_providers {
    bunnynet = {
      source  = "BunnyWay/bunnynet"
      version = "~> 0.13"
    }
  }

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
