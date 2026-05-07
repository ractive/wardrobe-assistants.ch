// libSQL database `wa-admin-prod`.
// Auth tokens are minted via `hoppy db token mint` (CLI) or the dashboard;
// they're never stored in OpenTofu state.
// Snapshots / restore use bunny's built-in generation feed: `hoppy db versions`
// + `hoppy db restore`.

resource "bunnynet_database" "wa_admin_prod" {
  name            = "wa-admin-prod"
  regions_primary = ["DE"]

  lifecycle {
    prevent_destroy = true
  }
}
