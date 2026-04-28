param(
  [string]$Branch = "master",
  [string]$CommitMessage = "feat: update employee video grading workbench",
  [switch]$SkipBuild,
  [switch]$SkipCommit,
  [switch]$SkipPush,
  [switch]$SkipVercel
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$FrontendDir = Join-Path $RepoRoot "frontend"
$BackendDir = Join-Path $RepoRoot "backend"

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Action
  )

  Write-Host ""
  Write-Host "==> $Name" -ForegroundColor Cyan
  & $Action
}

function Invoke-Checked {
  param(
    [string]$FilePath,
    [string[]]$Arguments
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    $joined = ($Arguments -join " ")
    throw "Command failed: $FilePath $joined"
  }
}

if (!(Test-Path $FrontendDir)) { throw "Missing directory: $FrontendDir" }
if (!(Test-Path $BackendDir)) { throw "Missing directory: $BackendDir" }

Invoke-Step "Repo root: $RepoRoot" {}

if (-not $SkipBuild) {
  Invoke-Step "Build frontend" {
    Invoke-Checked "npm" @("--prefix", $FrontendDir, "run", "build")
  }

  Invoke-Step "Build backend" {
    Invoke-Checked "npm" @("--prefix", $BackendDir, "run", "build")
  }
}

$statusOutput = (& git -C $RepoRoot status --short)
if ($LASTEXITCODE -ne 0) {
  throw "Unable to read git status."
}

if ([string]::IsNullOrWhiteSpace(($statusOutput | Out-String))) {
  Write-Host ""
  Write-Host "Working tree is clean." -ForegroundColor Green
} else {
  if ($SkipCommit) {
    Write-Host ""
    Write-Host "Skip commit requested. Pending changes:" -ForegroundColor Yellow
    $statusOutput | ForEach-Object { Write-Host $_ }
  } else {
    Invoke-Step "Stage changes" {
      Invoke-Checked "git" @("-C", $RepoRoot, "add", "-A")
    }

    & git -C $RepoRoot diff --cached --quiet
    $hasStagedChanges = $LASTEXITCODE -ne 0

    if ($hasStagedChanges) {
      Invoke-Step "Commit changes" {
        Invoke-Checked "git" @("-C", $RepoRoot, "commit", "-m", $CommitMessage)
      }
    } else {
      Write-Host ""
      Write-Host "No staged changes to commit." -ForegroundColor Yellow
    }
  }
}

if (-not $SkipPush) {
  if ($SkipCommit) {
    throw "Cannot push while -SkipCommit is set."
  }
  Invoke-Step "Push to origin/$Branch" {
    Invoke-Checked "git" @("-C", $RepoRoot, "push", "origin", $Branch)
  }
}

if (-not $SkipVercel) {
  $vercelCommand = Get-Command "vercel" -ErrorAction SilentlyContinue
  if ($null -eq $vercelCommand) {
    Write-Warning "Vercel CLI is not available. Skip Vercel deploy."
  } else {
    Invoke-Step "Deploy frontend to Vercel" {
      Push-Location $FrontendDir
      try {
        $vercelOutput = & $vercelCommand.Source deploy --prod --yes 2>&1
        $exitCode = $LASTEXITCODE
        $vercelOutput | ForEach-Object { Write-Host $_ }
        if ($exitCode -ne 0) {
          throw "Vercel deploy failed."
        }

        $vercelUrl = $vercelOutput |
          Select-String -Pattern "https://[A-Za-z0-9.-]+\.vercel\.app" |
          Select-Object -Last 1 |
          ForEach-Object { $_.Matches[0].Value }

        if ($vercelUrl) {
          Write-Host ""
          Write-Host "Vercel production URL: $vercelUrl" -ForegroundColor Green
        }
      } finally {
        Pop-Location
      }
    }
  }
}

Write-Host ""
Write-Host "Render deployment is triggered by git push after the backend service is connected to this repository." -ForegroundColor Green
