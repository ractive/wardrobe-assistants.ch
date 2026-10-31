// Magic Container app + image registry.
//
// The app `wardrobe-assistants-admin` (id var.admin_container_app_id) is
// deliberately NOT a resource here. The provider (bunnynet_compute_container_app,
// 0.14.0) reads every environment variable of the container, value included
// and not marked sensitive, into the state on import and on every refresh.
// `lifecycle { ignore_changes = [container] }` only stops OpenTofu from
// changing the block; it does not keep the values out of the state, and a
// plan diff on the block prints them. This repo is public, so the plan output
// in PR comments and Actions logs is public too. ADR-025 in
// kb/admin-architecture/decision-log.md has the reasoning.
//
// What OpenTofu does instead: the `removed` block below drops the app from the
// state without destroying it, and two data sources read the container and its
// CDN endpoint. They store only ids, names, the public host and the endpoint's
// pull zone id. The plan fails if the app, the container or the endpoint is
// gone, so the daily drift check fails (a red run, not a drift issue) when the
// app is deleted.
//
// Owned elsewhere:
//   - the running image: .github/workflows/deploy.yml;
//   - the environment: `hoppy container template env --add KEY=VALUE`; the
//     values live in the owner's password manager and nowhere else;
//   - recreating the app after a total loss: kb/runbooks/iac-runbook.md,
//     "Recreating the admin container app".
//
// Required container env (set via `hoppy container template env --add`):
//   BETTER_AUTH_SECRET    64-hex; rotate via hoppy when length != 64
//   BETTER_AUTH_URL       https://admin.wardrobe-assistants.ch
//   DATABASE_URL          libsql://<…>.turso.io (also output by database.tf)
//   DATABASE_AUTH_TOKEN   libSQL JWT
//   RESEND_API_KEY        re_xxx
//   EMAIL_FROM            "Wardrobe Assistants <info@wardrobe-assistants.ch>"
//   NODE_ENV              "production"
//   PORT                  3000
//   HOSTNAME              0.0.0.0
//
// Required for iter-23 web push (admin PWA notifications):
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY   ~87 base64url chars; inlined by `next
//                                  build` into the client bundle — set as
//                                  GH Actions variable VAPID_PUBLIC_KEY,
//                                  NOT as container runtime env. The
//                                  deploy workflow passes it as a Docker
//                                  build-arg (see .github/workflows/deploy.yml).
//   VAPID_PRIVATE_KEY              ~43 base64url chars; runtime container
//                                  env only — NEVER expose to client.
//   VAPID_SUBJECT                  mailto:info@wardrobe-assistants.ch;
//                                  runtime container env.
// Generate with `npx web-push generate-vapid-keys --json`. Rotation
// invalidates every existing browser subscription — treat as permanent.

resource "bunnynet_compute_container_imageregistry" "ghcr_ractive" {
  registry = "GitHub"
  username = "ractive"
  token    = "managed-out-of-band"

  lifecycle {
    // The provider's "registry" field expects "GitHub" but bunny's API
    // returns the display name "GitHub Packages ractive" — ignore to
    // prevent force-replace. Token is a write-only secret.
    //
    // The literal "managed-out-of-band" token below is harmless on the
    // current already-imported resource (ignore_changes covers updates),
    // but it would be sent on a fresh create — see prevent_destroy.
    //
    // The state holds `token = ""` (marked sensitive), never the GitHub PAT.
    ignore_changes  = [token, registry]
    prevent_destroy = true
  }
}

// Forget the app; never destroy it. After the next `tofu apply` the state no
// longer holds the container env.
//
// WARNING: the plan for this forget prints the whole resource, all env values
// included, in plain text. Run that apply on the laptop *before* pushing the
// branch that adds this block; otherwise terraform-plan.yml publishes every
// secret in the PR comment, the Actions log and the plan artefact. Once the
// app is out of the state, the plan is "No changes" and safe to publish.
// Keep this block until that apply has run on the laptop: without it (and without the resource) OpenTofu would plan to
// destroy the running app, and prevent_destroy no longer guards it.
removed {
  from = bunnynet_compute_container_app.admin

  lifecycle {
    destroy = false
  }
}

data "bunnynet_compute_container_app_container" "admin" {
  app  = var.admin_container_app_id
  name = "wardrobe-assistants-admin"
}

data "bunnynet_compute_container_app_container_endpoint" "admin_cdn" {
  app       = var.admin_container_app_id
  container = data.bunnynet_compute_container_app_container.admin.id
  name      = "admin-cdn"
}
