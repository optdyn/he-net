# Workflows

## New Website

1. Add the domain to HE.net.
2. Generate desired website records.
3. Plan against HE.net.
4. Apply with confirmations.
5. Verify authoritative answers.
6. Update registrar delegation to HE.net nameservers.

## Google Workspace

Use `workflow google-workspace` to generate MX, SPF, and DMARC records.
DKIM requires the selector and TXT value from Google Admin and should be added
as an explicit TXT record.

## Slave Conversion

Use `he inspect-convert` first. If HE.net exposes a valid `Convert!` control for
the exact slave zone, use `he convert-slave` with confirmations and then verify
records. If conversion is unavailable or fails, build a delete/recreate fallback
plan from preserved raw zone captures before making any destructive change.
