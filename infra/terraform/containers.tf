// Magic Container app + image registry.
//
// Secret hygiene:
//   - Container env vars (BETTER_AUTH_SECRET, DATABASE_AUTH_TOKEN, ...)
//     are set out-of-band and **must never** end up in OpenTofu state.
//   - The whole `container { }` block is excluded via ignore_changes,
//     so OpenTofu tracks the app's identity (name, regions, autoscaling)
//     but neither reads nor writes its inner contents.
//   - Image registry token is write-only and managed via GitHub Actions.
//
// Required container env (set via `scripts/set-app-env.sh` or directly via
// `hoppy container template env --add`):
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
    ignore_changes  = [token, registry]
    prevent_destroy = true
  }
}

resource "bunnynet_compute_container_app" "admin" {
  name                = "wardrobe-assistants-admin"
  version             = 2
  regions_required    = ["DE"]
  regions_allowed     = ["DE"]
  regions_max_allowed = 1

  container {
    name            = "wardrobe-assistants-admin"
    image_registry  = bunnynet_compute_container_imageregistry.ghcr_ractive.id
    image_namespace = "ractive"
    image_name      = "wardrobe-assistants-admin"
    image_tag       = "latest"

    endpoint {
      name = "admin-cdn"
      type = "CDN"

      cdn {
        origin_ssl = false
      }

      port {
        container = 3000
      }
    }

    // env blocks deliberately omitted — see ignore_changes below.
  }

  lifecycle {
    // The whole container sub-block is owned by the deploy pipeline:
    //   - env vars (secrets) are injected via dashboard/CI
    //   - image_tag is bumped by the deploy workflow on every release
    ignore_changes  = [container]
    prevent_destroy = true
  }
}
