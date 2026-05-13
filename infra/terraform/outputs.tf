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

output "admin_static_pullzone_cdn_hostname" {
  description = "System CDN URL for the admin static-asset pull zone (iter-41 — copy verbatim into the ADMIN_ASSET_PREFIX repo variable; Next.js `assetPrefix` requires a full URL incl. scheme)"
  value       = "https://${bunnynet_pullzone.admin_static.name}.b-cdn.net"
}

output "admin_static_storage_endpoint" {
  description = "Bunny Storage Zone endpoint for the admin _next/static/ uploads (iter-41)"
  value       = "https://storage.bunnycdn.com/${bunnynet_storage_zone.admin_static.name}/"
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
