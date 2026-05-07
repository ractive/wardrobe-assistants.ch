variable "bunny_api_key" {
  description = "Bunny.net account API key. Set via TF_VAR_bunny_api_key (typically maps to BUNNY_API_KEY in .env.local)."
  type        = string
  sensitive   = true
}

variable "dns_zone_id" {
  description = "Bunny DNS zone ID for wardrobe-assistants.ch."
  type        = number
  default     = 775662
}

variable "homepage_storage_zone_id" {
  description = "Bunny Storage Zone ID for the static homepage build artefacts."
  type        = number
  default     = 1498270
}

variable "tf_state_storage_zone_id" {
  description = "Bunny Storage Zone ID holding the OpenTofu remote state."
  type        = number
  default     = 1503083
}

variable "homepage_pull_zone_id" {
  description = "Bunny Pull Zone ID fronting the homepage storage zone."
  type        = number
  default     = 5798479
}

variable "admin_pull_zone_id" {
  description = "Bunny Pull Zone ID fronting the admin Magic Container endpoint."
  type        = number
  default     = 5798594
}

variable "admin_container_app_id" {
  description = "Magic Container App ID for the admin runtime."
  type        = string
  default     = "h4vme6Uhod4W3Yu"
}

variable "container_registry_id" {
  description = "Bunny Container Registry ID — GitHub Packages (ractive)."
  type        = number
  default     = 5602
}

variable "database_id" {
  description = "Bunny libSQL Database ID for wa-admin-prod."
  type        = string
  default     = "db_01KQV95KJ611YYT48VSZKHC495"
}
