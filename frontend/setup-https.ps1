$ErrorActionPreference = 'Stop'

$mkcertCommand = Get-Command mkcert -ErrorAction SilentlyContinue
if (-not $mkcertCommand) {
  Write-Error 'mkcert is not installed. Install it with: winget install --id FiloSottile.mkcert -e'
  exit 1
}

$network = Get-NetIPConfiguration |
  Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address } |
  Sort-Object @{
    Expression = {
      if ($_.InterfaceAlias -match 'Wi-Fi|Wireless|WLAN') { 0 }
      else { 1 }
    }
  } |
  Select-Object -First 1

if (-not $network) {
  Write-Error 'No active network with an IPv4 gateway was found.'
  exit 1
}

$ipv4 = $network.IPv4Address |
  Where-Object { $_.IPAddress -notlike '169.254.*' } |
  Select-Object -First 1 -ExpandProperty IPAddress

if (-not $ipv4) {
  Write-Error 'Could not determine this computer''s local IPv4 address.'
  exit 1
}

& mkcert -install
if ($LASTEXITCODE -ne 0) {
  Write-Error 'mkcert could not install its local certificate authority.'
  exit $LASTEXITCODE
}

$certificateDirectory = Join-Path $PSScriptRoot '.devcerts'
New-Item -ItemType Directory -Path $certificateDirectory -Force | Out-Null
$certificatePath = Join-Path $certificateDirectory 'lan.pem'
$privateKeyPath = Join-Path $certificateDirectory 'lan-key.pem'

& mkcert -cert-file $certificatePath -key-file $privateKeyPath $ipv4 localhost 127.0.0.1 ::1
if ($LASTEXITCODE -ne 0) {
  Write-Error 'mkcert could not create the local HTTPS certificate.'
  exit $LASTEXITCODE
}

$certificateAuthorityDirectory = (& mkcert -CAROOT).Trim()
if ($LASTEXITCODE -ne 0) {
  Write-Error 'Could not locate the mkcert root certificate.'
  exit $LASTEXITCODE
}

Copy-Item `
  -Path (Join-Path $certificateAuthorityDirectory 'rootCA.pem') `
  -Destination (Join-Path $certificateDirectory 'phone-rootCA.pem') `
  -Force

Write-Host ''
Write-Host "HTTPS certificate created for $ipv4."
Write-Host "On this computer: https://${ipv4}:5173"
Write-Host "Phone trust certificate: $(Join-Path $certificateDirectory 'phone-rootCA.pem')"
Write-Host 'Transfer phone-rootCA.pem to your phone and install it as a trusted CA certificate.'
Write-Host 'Restart the frontend with: npm run dev'
