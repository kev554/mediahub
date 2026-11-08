param(
    [switch]$Register,
    [switch]$Unregister,
    [string]$Time = "03:00"
)

$ErrorActionPreference = "Stop"

if ($Register -and $Unregister) {
    throw "Choose either -Register or -Unregister, not both."
}

$taskName = "MediaHub-ExpiredTrashPurge"

if ($Unregister) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Output "Scheduled task '$taskName' removed if it existed."
    exit 0
}

if (-not $Register) {
    Write-Output "No changes made. Use -Register to install the daily purge task or -Unregister to remove it."
    exit 0
}

try {
    $parsedTime = [DateTime]::ParseExact(
        $Time,
        "HH:mm",
        [Globalization.CultureInfo]::InvariantCulture
    )
}
catch {
    throw "Invalid time '$Time'. Use 24-hour HH:mm format, for example 03:00."
}

$backendDirectory = $PSScriptRoot
$environmentFile = Join-Path $backendDirectory ".env"
if (-not (Test-Path $environmentFile -PathType Leaf)) {
    throw "Backend .env was not found. Create and validate it before scheduling destructive trash purges."
}

$pythonCandidates = @(
    (Join-Path $backendDirectory ".venv\Scripts\python.exe"),
    (Join-Path $backendDirectory "venv\Scripts\python.exe")
)
$pythonPath = $pythonCandidates | Where-Object { Test-Path $_ -PathType Leaf } | Select-Object -First 1
if (-not $pythonPath) {
    $pythonCommand = Get-Command python.exe -ErrorAction SilentlyContinue
    if (-not $pythonCommand) {
        throw "Python was not found. Install backend dependencies in backend\.venv or add python.exe to PATH."
    }
    $pythonPath = $pythonCommand.Source
}

$action = New-ScheduledTaskAction `
    -Execute $pythonPath `
    -Argument "-u `"purge_expired_trash.py`"" `
    -WorkingDirectory $backendDirectory
$trigger = New-ScheduledTaskTrigger -Daily -At $parsedTime
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2)
$principal = New-ScheduledTaskPrincipal `
    -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Limited
$task = New-ScheduledTask `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Permanently removes MediaHub trash items older than TRASH_RETENTION_DAYS."

Register-ScheduledTask -TaskName $taskName -InputObject $task -Force | Out-Null
Write-Output "Registered '$taskName' to run daily at $($parsedTime.ToString('HH:mm'))."
Write-Output "It runs as the current Windows user and only while that user is logged in."
Write-Output "Logs: $(Join-Path $backendDirectory 'logs\trash-purge.log')"
