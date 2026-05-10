// DNS zone + records for wardrobe-assistants.ch.
//
// Email stack — two separate email systems coexist by design:
//   - ImprovMX (apex): handles inbound mail to info@wardrobe-assistants.ch.
//     Apex MX records (improvmx_mx_1 / improvmx_mx_2) and the apex SPF TXT
//     (apex_spf_txt) are tofu-managed in this file.
//   - Resend (send.* subdomain): handles outbound transactional mail. Uses
//     send.wardrobe-assistants.ch as the MAIL FROM envelope domain, so SPF
//     lives at send.* (not the apex). DKIM and the send.* records are
//     dashboard-managed (lifecycle.ignore_changes = all) — the Resend
//     dashboard is the source of truth for those.
//
// The four records 17098158/17098159/17098160/17098161 belong to the Resend
// email stack. They're imported for visibility; lifecycle.ignore_changes = all
// keeps OpenTofu from modifying them. The Resend dashboard is the source of
// truth for those four; rotating the DKIM key happens there.

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

  lifecycle {
    prevent_destroy = true
  }
}

resource "bunnynet_dns_record" "www_cname" {
  zone  = bunnynet_dns_zone.wardrobe_assistants_ch.id
  type  = "CNAME"
  name  = "www"
  value = "wardrobe-assistants-ch.b-cdn.net"
  ttl   = 0

  lifecycle {
    prevent_destroy = true
  }
}

resource "bunnynet_dns_record" "admin_cname" {
  zone  = bunnynet_dns_zone.wardrobe_assistants_ch.id
  type  = "CNAME"
  name  = "admin"
  value = "mc-r6f39iacv2.b-cdn.net"
  ttl   = 0

  lifecycle {
    prevent_destroy = true
  }
}

// iter-20: DMARC now has an rua= reporting address (forwarded via ImprovMX).
// ignore_changes removed so tofu can drive the value. Next progression:
// tighten to p=quarantine; pct=25 once reports are clean, then p=reject.
resource "bunnynet_dns_record" "dmarc_txt" {
  zone  = bunnynet_dns_zone.wardrobe_assistants_ch.id
  type  = "TXT"
  name  = "_dmarc"
  value = "v=DMARC1; p=none; rua=mailto:dmarc-reports@wardrobe-assistants.ch;"
  ttl   = 0

  lifecycle {
    prevent_destroy = true
  }
}

resource "bunnynet_dns_record" "resend_dkim_txt" {
  zone  = bunnynet_dns_zone.wardrobe_assistants_ch.id
  type  = "TXT"
  name  = "resend._domainkey"
  value = "managed-by-resend-see-dashboard"
  ttl   = 0

  lifecycle {
    ignore_changes  = all
    prevent_destroy = true
  }
}

resource "bunnynet_dns_record" "send_spf_txt" {
  zone  = bunnynet_dns_zone.wardrobe_assistants_ch.id
  type  = "TXT"
  name  = "send"
  value = "v=spf1 include:amazonses.com ~all"
  ttl   = 0

  lifecycle {
    ignore_changes  = all
    prevent_destroy = true
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
    ignore_changes  = all
    prevent_destroy = true
  }
}

# iter-20: ImprovMX apex MX records for inbound info@wardrobe-assistants.ch.
# These are tofu-managed (no lifecycle.ignore_changes) — the source of truth
# is this file. ImprovMX coexists with Resend's send.* subdomain by design:
# Resend uses send.wardrobe-assistants.ch for MAIL FROM, so apex MX belongs
# entirely to ImprovMX.
resource "bunnynet_dns_record" "improvmx_mx_1" {
  zone     = bunnynet_dns_zone.wardrobe_assistants_ch.id
  type     = "MX"
  name     = ""
  value    = "mx1.improvmx.com"
  priority = 10
  ttl      = 0
}

resource "bunnynet_dns_record" "improvmx_mx_2" {
  zone     = bunnynet_dns_zone.wardrobe_assistants_ch.id
  type     = "MX"
  name     = ""
  value    = "mx2.improvmx.com"
  priority = 20
  ttl      = 0
}

# Apex SPF for ImprovMX (inbound). Only one apex SPF record is allowed per
# RFC 7208. Resend's MAIL FROM uses send.wardrobe-assistants.ch (its own SPF
# lives there), so the apex only needs ImprovMX. If Resend ever switches to
# apex MAIL FROM, merge: v=spf1 include:_spf.resend.com include:spf.improvmx.com ~all
resource "bunnynet_dns_record" "apex_spf_txt" {
  zone  = bunnynet_dns_zone.wardrobe_assistants_ch.id
  type  = "TXT"
  name  = ""
  value = "v=spf1 include:spf.improvmx.com ~all"
  ttl   = 0
}
