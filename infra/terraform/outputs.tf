output "dns_zone_id" {
  description = "Bunny DNS zone ID for wardrobe-assistants.ch"
  value       = bunnynet_dns_zone.wardrobe_assistants_ch.id
}

output "homepage_pullzone_cdn_hostname" {
  description = "System CDN hostname for the homepage pull zone"
  value       = "wardrobe-assistants-ch.b-cdn.net"
}

output "admin_pullzone_cdn_hostname" {
  description = "System CDN hostname for the admin (Magic Container) pull zone"
  value       = "mc-r6f39iacv2.b-cdn.net"
}

output "homepage_storage_endpoint" {
  description = "Bunny Storage Zone storage endpoint for the homepage build artefacts"
  value       = "https://storage.bunnycdn.com/wardrobe-assistants-ch-homepage/"
}

output "admin_container_app_id" {
  description = "Magic Container app id for the admin runtime"
  value       = bunnynet_compute_container_app.admin.id
}

output "database_url" {
  description = "libSQL connection URL for wa-admin-prod (auth token not managed by OpenTofu)"
  value       = bunnynet_database.wa_admin_prod.url
  sensitive   = true
}
