# Sätter Supabase-secrets i GitHub (lagras INTE i repot).
# Kräver: gh auth login
#
# Exempel:
#   $env:SUPABASE_ANON_KEY = "sb_publishable_..."
#   .\scripts\set-supabase-github-secrets.ps1
#
# URL kan sättas via $env:SUPABASE_URL eller använder standard nedan.

$ErrorActionPreference = "Stop"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Error "GitHub CLI (gh) saknas. Installera: winget install GitHub.cli"
}

$auth = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Error "Kör först: gh auth login"
}

$url = if ($env:SUPABASE_URL) { $env:SUPABASE_URL.Trim() } else { "https://bbithvljqdsgqbjwitil.supabase.co" }
$url = $url -replace '/rest/v1/?$', '' -replace '/+$', ''

$key = $env:SUPABASE_ANON_KEY
if (-not $key -or -not $key.Trim()) {
  Write-Error "Sätt SUPABASE_ANON_KEY (publishable/anon) i miljön innan du kör skriptet."
}
$key = $key.Trim()

if ($key -match '\.supabase\.co') {
  Write-Error "SUPABASE_ANON_KEY ser ut som en URL. Använd publishable/anon-nyckeln."
}
if ($key -notmatch '^(eyJ|sb_publishable_)') {
  Write-Error "SUPABASE_ANON_KEY ogiltig. Förväntar eyJ... eller sb_publishable_..."
}

Write-Host "Sätter repository secrets (värden visas inte)..."
gh secret set SUPABASE_URL --body $url
gh secret set SUPABASE_ANON_KEY --body $key
gh secret set VITE_SUPABASE_URL --body $url
gh secret set VITE_SUPABASE_ANON_KEY --body $key

Write-Host "Klart. Kör deploy: gh workflow run deploy-pages.yml"
