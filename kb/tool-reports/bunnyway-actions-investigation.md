---
title: BunnyWay/actions container-update-image — env-wipe investigation (action exonerated)
type: tool-report
tool: bunnyway-actions
date: 2026-05-05
status: closed-no-bug
related:
  - hoppy-bug-report-magic-containers.md
  - iteration-09-go-live-bunny-infra.md
---

# BunnyWay/actions container-update-image — investigation

iter-9 reported a critical footgun: after a `BunnyWay/actions/container-update-image@main` roll, the admin Magic Container's `containerTemplates[0].environmentVariables` was empty, breaking sign-in. Initial hypothesis: the action's PATCH wipes env vars when the request body omits them. **This investigation refutes that hypothesis.**

## TL;DR

- The BunnyWay action is **innocent**. Its PATCH does NOT wipe `environmentVariables`. The bunny.net Magic Containers PATCH endpoint correctly treats omitted fields as "preserve."
- Pod recreate (`hoppy container pod recreate`) also does not wipe env.
- The actual mechanism that wipes env in `iter-9` was almost certainly **`hoppy container template env` invoked with a wrong `--env` arg list** — its documented "replaces all" semantics destroy any env name not present in the call. See [`hoppy-bug-report-magic-containers.md` MC.1 and MC.5](hoppy-bug-report-magic-containers.md) for the corrected hoppy finding.

## Reproduction setup

- Live admin app `h4vme6Uhod4W3Yu`, container template `h4vme6Uhod4W3Yu-63yu`.
- 9 env vars set to working values via `hoppy container template env --env DATABASE_URL=… …`.
- User authorised brief admin downtime for the test.

## Test 1 — direct PATCH replicating the BunnyWay action's request

The action source at https://github.com/BunnyWay/actions/blob/main/container-update-image/src/action.ts shows it calls:

```
PATCH https://api.bunny.net/mc/apps/{appId}/containers/{containerId}
Headers: Content-Type: application/json, AccessKey: {apiKey}
Body: { "id": "{containerId}", "imageTag": "{tag}", "imageDigest"?: "{digest}" }
```

No `environmentVariables` in the body. No prior GET-merge.

Reproduced with curl, using the same image_tag the container is already on (no actual roll):

```bash
curl -X PATCH \
  -H "AccessKey: $BUNNY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id":"h4vme6Uhod4W3Yu-63yu","imageTag":"09fad6cebf25e8979fee56b467681fe219d7f6b6"}' \
  "https://api.bunny.net/mc/apps/h4vme6Uhod4W3Yu/containers/h4vme6Uhod4W3Yu-63yu"
```

**Before:** `envCount=9` (all original vars present).
**HTTP response:** `200 OK`, body contains the full template document including the unchanged 9 env vars.
**After:** `envCount=9`, names match exactly.

**Conclusion:** the bunny.net Magic Containers PATCH endpoint preserves omitted fields. `environmentVariables` was untouched.

## Test 2 — pod recreate

```bash
hoppy container pod recreate --app-id h4vme6Uhod4W3Yu --pod-id <pod>
```

**Before:** `envCount=9`. **After:** `envCount=9`. Pod recreate does NOT wipe env vars either.

## Test 3 — hoppy `template env` with zero `--env` flags (the actual bug)

```bash
hoppy --yes container template env \
  --app-id h4vme6Uhod4W3Yu \
  --container-id h4vme6Uhod4W3Yu-63yu
```

(no `--env` flags at all)

**Before:** `envCount=9`. **After:** `envCount=0`.

The command exits 0, prints the template metadata, and silently wipes all env vars. No warning, no confirmation prompt despite `--yes` not being intended for destructive env clearing.

## Test 4 — hoppy `template env` with one `--env` flag (replaces all to that one)

```bash
hoppy --yes container template env \
  --app-id h4vme6Uhod4W3Yu \
  --container-id h4vme6Uhod4W3Yu-63yu \
  --env "DATABASE_URL=$DB_URL"
```

**Before:** `envCount=9`. **After:** `envCount=1, names=['DATABASE_URL']`.

The "replaces all" semantics in the `--help` text is exact: N `--env` flags → exactly N env vars after the call, all others gone. There is no `--add` or `--remove` flag for granular updates.

## Why was env empty in iter-9 then?

The wipe definitely happened — it was directly observed in the curl response body during sign-in failure investigation. After ruling out BunnyWay PATCH and pod recreate via Tests 1+2, the most likely explanation is:

- **An accidental `hoppy container template env` invocation** somewhere in the iter-9 cutover with the wrong arg list — possibly a shell variable that was empty (e.g. `$RESEND` was empty before the user provided their key, leading to an env-set with one of the 9 args having an empty value, which hoppy may have rejected as malformed and yet committed a partial replace; or a stray invocation without `--env` flags during ad-hoc debugging).
- **Or** a transient bunny.net side-effect when a container repeatedly crashes (the admin failed to start 6× during the iter-9 migrate-on-boot loop). Not reproduced in this investigation; can't confirm.

Either way, the operational risk now lives in `hoppy template env`, not in BunnyWay's action.

## Recommendations

### For BunnyWay/actions

**No action required.** The container-update-image action is correct as written. Could optionally add a defensive note in the README that env vars are preserved by the bunny PATCH endpoint, to head off future false alarms. But that's documentation, not a code fix.

### For hoppy

Track in [`hoppy-bug-report-magic-containers.md` MC.1 (rewritten) and MC.5](hoppy-bug-report-magic-containers.md). Specifically:

1. `hoppy container template env` with **zero `--env` flags** should error out (or require `--clear` flag) instead of silently wiping. Operators don't accidentally type the destructive form.
2. Add `--add KEY=VAL`, `--remove KEY`, `--update KEY=VAL` for granular operations. The "replaces all" form should be opt-in via `--replace-all`.
3. When the call would wipe env vars (current state has N>0, new state has 0), require a `--allow-clear` flag. This is a destructive transition that deserves an explicit affirmation.

### For iter-9 documentation

Retract deviation #7's claim that BunnyWay's PATCH wipes env. Rewrite to say: env was wiped by an unidentified hoppy invocation, not by BunnyWay. The post-roll-reassert-env mitigation in deviation #7 is still useful as defensive engineering, but it solves a different problem than originally claimed.

## Conclusion

- **BunnyWay/actions/container-update-image**: bug-free as far as iter-9 evidence shows. No bug report filed upstream.
- **bunny.net Magic Containers API PATCH semantics**: standard partial-update — omitted fields preserved. No bug.
- **hoppy `container template env`**: correct per `--help` ("replaces all"), but the "all" includes "to zero entries when called with no `--env` flags," which is a footgun. Tracked in the hoppy bug reports. Also a candidate for a `--protect-from-zero-args` style guard rail.
