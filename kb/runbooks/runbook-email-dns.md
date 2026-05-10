---
title: Email DNS runbook
type: runbook
status: active
---

# Email DNS runbook

Documents the dual-stack email DNS for `wardrobe-assistants.ch` added in iter-20.

## Architecture

Two email systems coexist on the same domain by design:

| System | Scope | Purpose |
|--------|-------|---------|
| ImprovMX | Apex (`wardrobe-assistants.ch`) | Inbound mail — forwards `info@wardrobe-assistants.ch` to the configured destination mailbox |
| Resend | `send.*` subdomain | Outbound transactional mail — the admin app sends via `send.wardrobe-assistants.ch` as the MAIL FROM envelope |

They coexist without conflict because Resend uses `send.wardrobe-assistants.ch` (not the apex) for its MAIL FROM envelope, so apex MX belongs entirely to ImprovMX and the apex SPF only needs to include ImprovMX.

## DNS records

### ImprovMX (tofu-managed, `infra/terraform/dns.tf`)

| Type | Name | Value | Priority |
|------|------|-------|----------|
| MX | `wardrobe-assistants.ch` | `mx1.improvmx.com` | 10 |
| MX | `wardrobe-assistants.ch` | `mx2.improvmx.com` | 20 |
| TXT | `wardrobe-assistants.ch` | `v=spf1 include:spf.improvmx.com ~all` | — |

**Note:** Only one apex SPF TXT record is allowed (RFC 7208). If Resend ever switches to apex MAIL FROM, the SPF must be merged: `v=spf1 include:_spf.resend.com include:spf.improvmx.com ~all`.

### Resend (dashboard-managed, `lifecycle.ignore_changes = all`)

| Type | Name | Purpose |
|------|------|---------|
| TXT | `resend._domainkey` | Resend DKIM — managed via Resend dashboard |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` — Resend SPF for `send.*` |
| MX | `send` | Resend bounce handling via Amazon SES |

### DMARC

| Type | Name | Value |
|------|------|-------|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc-reports@wardrobe-assistants.ch;` |

DMARC reports are sent to `dmarc-reports@wardrobe-assistants.ch`, which ImprovMX forwards to the configured destination mailbox. The progression plan: monitor reports for one week, then tighten to `p=quarantine; pct=25`, then `p=reject` once reports are clean.

## Verification

After `tofu apply`:

```sh
# ImprovMX MX records
dig MX wardrobe-assistants.ch +short
# Should return: 10 mx1.improvmx.com. and 20 mx2.improvmx.com.

# Apex SPF (must be exactly one TXT starting with v=spf1)
dig TXT wardrobe-assistants.ch +short
# Should return: "v=spf1 include:spf.improvmx.com ~all"
# (Multiple SPF records = automatic spam — check carefully)

# DMARC
dig TXT _dmarc.wardrobe-assistants.ch +short
# Should include rua=mailto:dmarc-reports@...
```

Then:
1. Log in to the ImprovMX dashboard — both MX and SPF should show a green checkmark.
2. Send a test mail to `info@wardrobe-assistants.ch` and confirm it arrives at the configured destination mailbox.

## Production EMAIL_FROM

The `EMAIL_FROM` environment variable for the admin app is injected via bunny Magic Container and must be:

```
Wardrobe Assistants <info@wardrobe-assistants.ch>
```

Rotate via `hoppy template env --update` (do not edit the container app env directly — use `hoppy` to keep the pipeline in sync). See `kb/admin-architecture/decision-log.md` for the iter-13 pattern.
