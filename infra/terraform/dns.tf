// DNS zone + 7 records for wardrobe-assistants.ch.
// Records 17098158/17098159/17098160/17098161 are managed by Resend
// (DKIM, MX, SPF, DMARC); we import them for visibility but
// ignore_changes = all so OpenTofu never modifies them.

resource "bunnynet_dns_zone" "wardrobe_assistants_ch" {
  domain = "wardrobe-assistants.ch"

  lifecycle {
    prevent_destroy = true
  }
}

resource "bunnynet_dns_record" "apex_cname" {
  zone  = bunnynet_dns_zone.wardrobe_assistants_ch.id
  type  = "CNAME"
  name  = ""
  value = "wardrobe-assistants-ch.b-cdn.net"
  ttl   = 0
}

resource "bunnynet_dns_record" "www_cname" {
  zone  = bunnynet_dns_zone.wardrobe_assistants_ch.id
  type  = "CNAME"
  name  = "www"
  value = "wardrobe-assistants-ch.b-cdn.net"
  ttl   = 0
}

resource "bunnynet_dns_record" "admin_cname" {
  zone  = bunnynet_dns_zone.wardrobe_assistants_ch.id
  type  = "CNAME"
  name  = "admin"
  value = "mc-r6f39iacv2.b-cdn.net"
  ttl   = 0
}

resource "bunnynet_dns_record" "dmarc_txt" {
  zone  = bunnynet_dns_zone.wardrobe_assistants_ch.id
  type  = "TXT"
  name  = "_dmarc"
  value = "v=DMARC1; p=none;"
  ttl   = 0

  lifecycle {
    ignore_changes = all
  }
}

resource "bunnynet_dns_record" "resend_dkim_txt" {
  zone  = bunnynet_dns_zone.wardrobe_assistants_ch.id
  type  = "TXT"
  name  = "resend._domainkey"
  value = "managed-by-resend-see-dashboard"
  ttl   = 0

  lifecycle {
    ignore_changes = all
  }
}

resource "bunnynet_dns_record" "send_spf_txt" {
  zone  = bunnynet_dns_zone.wardrobe_assistants_ch.id
  type  = "TXT"
  name  = "send"
  value = "v=spf1 include:amazonses.com ~all"
  ttl   = 0

  lifecycle {
    ignore_changes = all
  }
}

resource "bunnynet_dns_record" "send_mx" {
  zone     = bunnynet_dns_zone.wardrobe_assistants_ch.id
  type     = "MX"
  name     = "send"
  value    = "feedback-smtp.eu-west-1.amazonses.com"
  priority = 10
  ttl      = 0

  lifecycle {
    ignore_changes = all
  }
}
