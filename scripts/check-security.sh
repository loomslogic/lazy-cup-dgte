#!/usr/bin/env bash
# Simple safety scan for the Lazy Cup site. Exit code 1 if something suspicious is found.
cd "$(dirname "$0")/.." || exit 1
ALLOWED='cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|www\.google\.com|maps\.app\.goo\.gl|[a-z0-9]+\.supabase\.co|www\.w3\.org|github\.com|example\.com'
bad=0
note(){ echo "WARNING: $1"; bad=1; }

# 1) links to hosts that are not on the allow list
hits=$(grep -rnoE --include='*.html' --include='*.js' --include='*.css' 'https?://[A-Za-z0-9._-]+' . 2>/dev/null \
  | grep -vE "$ALLOWED" | grep -v '^\./scripts/' | grep -v '^\./CLAUDE.md')
[ -n "$hits" ] && note "unknown external hosts:" && echo "$hits"

# 2) risky code patterns
hits=$(grep -rnE --include='*.html' --include='*.js' '(\beval\s*\(|new Function\s*\(|document\.write\s*\(|atob\s*\(|fromCharCode|sendBeacon|<iframe)' . | grep -v 'www.google.com/maps')
[ -n "$hits" ] && note "risky code patterns (eval / document.write / atob / sendBeacon / iframe):" && echo "$hits"

# 3) secrets
hits=$(grep -rnEi --include='*.html' --include='*.js' --include='*.sql' '(sb_secret_[A-Za-z0-9_-]{8,}|c2VydmljZV9yb2xl|sk-ant-[A-Za-z0-9_-]{8,}|BEGIN (RSA |EC )?PRIVATE KEY|password\s*[:=]\s*["'"'"'][^"'"'"']{4,})' . | grep -v '^\./CLAUDE.md' | grep -v '^\./scripts/')
[ -n "$hits" ] && note "possible secrets:" && echo "$hits"

# 4) config.js should only hold a URL and a publishable key
grep -qE "sb_secret_[A-Za-z0-9_-]{8,}|c2VydmljZV9yb2xl" config.js 2>/dev/null && note "config.js contains a secret key"

[ $bad -eq 0 ] && echo "OK: nothing suspicious found." || echo "Review the warnings above."
exit $bad
