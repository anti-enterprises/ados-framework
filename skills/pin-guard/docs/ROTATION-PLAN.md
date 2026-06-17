# Credential Rotation Plan

Use this after any incident where code executed on a machine with access to your
secrets (a RAT, a leaked `.env`, a compromised build). A RAT loader has unbounded
access, so the correct scope is "everything readable on the affected machine."
Work the tiers below by blast radius — you don't rotate everything at once.

## How to scope it

1. List every `.env` / `.env.local` on the affected machine:
   ```bash
   find ~ \( -name ".env" -o -name ".env.local" \) 2>/dev/null | grep -v node_modules
   ```
2. For each, list the KEY NAMES (never the values). That is your rotation
   surface.
3. Rotate in tiers — money and data first, cheap API keys last.

## TIER 0 — the directly-exposed project (rotate first)

The secrets loaded into the build environment the malware ran in. Typical set:

| Category | Keys to rotate |
|---|---|
| Payments | Stripe secret key + webhook secret (and any test-mode keys) |
| Database | `DATABASE_URL`, `DIRECT_URL`, DB password |
| Backend | Supabase `service_role` key (bypasses row-level security — top value) |
| Auth | session-signing secret (e.g. BetterAuth/NextAuth secret) |
| Jobs/infra | background-job secret (Trigger.dev etc.) |
| Identity | OAuth client IDs/secrets (Google, LinkedIn, GitHub) |
| Tokens | npm `_authToken` in `~/.npmrc`, GitHub PATs / deploy keys |

## TIER 1 — highest-value keys anywhere on the machine

Money, database, and auth secrets across ALL projects — they cause the most
damage if used, even in unrelated repos.

- **Payments:** every Stripe secret + webhook key
- **Database/cache:** all Postgres/MySQL URLs, Redis/Upstash tokens
- **Backend:** all Supabase service_role / access tokens
- **Auth/sessions/webhooks:** session secrets, Clerk/NextAuth/BetterAuth
  secrets, cron secrets, third-party webhook signing secrets (Svix, Stream,
  Shopify, Twilio, etc.)

## TIER 2 — AI / data API keys (cheap, do in a batch)

OpenAI, Anthropic, Google/Gemini, OpenRouter, Perplexity, Replicate, AssemblyAI,
plus scraping/data APIs (Apify, Firecrawl, Jina, Serper, etc.). Revoke +
regenerate, update each project's env and host.

## TIER 3 — personal / machine-level

- Browser-saved passwords -> change + enable 2FA everywhere
- SSH keys (`~/.ssh`) -> regenerate, update on GitHub/servers
- `~/.aws/credentials` if present
- Any crypto wallet ever opened on the machine -> move funds to a fresh wallet
  from a clean device (this malware family targets wallets)

## After rotating

1. Update the env vars in your hosting provider too (it keeps its own copy) and
   redeploy.
2. Move secrets to a manager (Doppler / Vault / hosted env) and stop committing
   `.env` files where a build can read them all at once.
3. Audit access logs on the highest-value services for the exposure window.

## Identify everyone affected

Anyone who cloned and **built** the infected project ran the loader. Trace
contributors and the introducing commit:

```bash
git shortlog -sne --all
git log --oneline -- <infected-file>   # find first bad commit + author
```

Every builder must run the self-check ([`TEAM-COMPROMISE-CHECK.md`](TEAM-COMPROMISE-CHECK.md))
and rotate their local credentials. Prioritize the machine of whoever introduced
the infected commit (likely patient zero).
