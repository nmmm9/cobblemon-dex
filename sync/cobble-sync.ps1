# 코블버스 포켓몬 동기화 (방장 PC용)
# 월드 폴더(level.dat 있는 곳)에 이 파일과 cobble-sync.bat을 넣고 bat을 더블클릭.
# 월드 파일은 읽기만 하고, 지정한 플레이어들의 코블몬 저장 파일만 구글 드라이브 폴더로 복사한다.
$world = $PSScriptRoot
if (-not (Test-Path -LiteralPath (Join-Path $world 'level.dat'))) {
  Write-Host '이 파일을 월드 폴더(level.dat 있는 곳)에 넣고 다시 실행해줘.'
  Read-Host '엔터 누르면 닫혀'; exit
}

$cfgPath = Join-Path $world 'cobble-sync.cfg.json'
$cfg = $null
if (Test-Path -LiteralPath $cfgPath) { $cfg = Get-Content -LiteralPath $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json }
if (-not $cfg) {
  $names = (Read-Host '보낼 사람들의 마인크래프트 닉네임 (여러 명이면 쉼표로: 닉1,닉2)') -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
  $cache = Join-Path (Split-Path (Split-Path $world)) 'usercache.json'
  $uc = if (Test-Path -LiteralPath $cache) { Get-Content -LiteralPath $cache -Raw -Encoding UTF8 | ConvertFrom-Json } else { @() }
  $players = foreach ($n in $names) {
    $u = $uc | Where-Object { $_.name -eq $n } | Select-Object -First 1
    $id = if ($u) { $u.uuid } else { Read-Host "$n 을(를) 못 찾았어. UUID를 직접 입력해줘 (하이픈 포함)" }
    [pscustomobject]@{ name = $n; uuid = $id.Trim().ToLower() }
  }

  $dest = $null
  foreach ($d in Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue) {
    foreach ($dn in '내 드라이브', 'My Drive') {
      $p = Join-Path $d.Root "$dn\cobble-sync"
      if (Test-Path -LiteralPath $p -ErrorAction SilentlyContinue) { $dest = $p }
    }
  }
  if (-not $dest) { $dest = Read-Host '구글 드라이브 cobble-sync 폴더 경로 (예: G:\내 드라이브\cobble-sync)' }

  $cfg = [pscustomobject]@{ players = @($players); dest = $dest.Trim('"', ' ') }
  $cfg | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $cfgPath -Encoding UTF8
}

# 사이트가 UUID -> 닉네임을 알 수 있게
$map = @{}; foreach ($p in $cfg.players) { $map[$p.uuid] = $p.name }
New-Item -ItemType Directory -Force -Path $cfg.dest | Out-Null
$map | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $cfg.dest 'players.json') -Encoding UTF8

Write-Host "월드: $world"
Write-Host "대상: $(($cfg.players | ForEach-Object { "$($_.name)($($_.uuid))" }) -join ', ')"
Write-Host "보내는 곳: $($cfg.dest)"
Write-Host '게임하는 동안 이 창을 켜 둬. (설정 다시 하려면 cobble-sync.cfg.json 지우기)'

# 바닐라 플레이어 파일(인벤토리·통계·발전과제)은 빼고 코블몬 파일만
$skip = '\\(playerdata|stats|advancements)\\'
$want = '(' + (($cfg.players | ForEach-Object { [regex]::Escape($_.uuid) }) -join '|') + ')'
$sent = @{}
while ($true) {
  $n = 0
  Get-ChildItem -LiteralPath $world -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -match $want -and $_.FullName -notmatch $skip } | ForEach-Object {
    $key = "$($_.Length)|$($_.LastWriteTimeUtc.Ticks)"
    if ($sent[$_.FullName] -eq $key) { return }
    $rel = $_.FullName.Substring($world.Length).TrimStart('\')
    $to = Join-Path $cfg.dest $rel
    try {
      New-Item -ItemType Directory -Force -Path (Split-Path $to) | Out-Null
      Copy-Item -LiteralPath $_.FullName -Destination "$to.tmp" -Force -ErrorAction Stop
      Move-Item -LiteralPath "$to.tmp" -Destination $to -Force -ErrorAction Stop
      $sent[$_.FullName] = $key; $n++
    } catch { }  # 게임이 쓰는 중이면 다음 바퀴에 다시
  }
  if ($n) {
    # 사이트가 파일을 하나씩 열면 20초 넘게 걸려서, 쓰는 파일(파티·박스·도감·닉네임)만 bundle.json 하나로 묶음
    $files = [ordered]@{}
    $base = $cfg.dest.TrimEnd('\')
    Get-ChildItem -LiteralPath $base -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
      $rel = $_.FullName.Substring($base.Length).TrimStart('\') -replace '\\', '/'
      if ($rel -match '^(players\.json|pokemon/(playerpartystore|pcstore)/.+\.dat|pokedex/.+\.nbt)$') {
        try { $files[$rel] = [Convert]::ToBase64String([IO.File]::ReadAllBytes($_.FullName)) } catch { }
      }
    }
    $json = @{ t = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); files = $files } | ConvertTo-Json -Compress
    try {
      [IO.File]::WriteAllText("$base\bundle.json.tmp", $json)
      Move-Item -LiteralPath "$base\bundle.json.tmp" -Destination "$base\bundle.json" -Force -ErrorAction Stop
    } catch { }
    Write-Host "[$(Get-Date -Format HH:mm:ss)] 파일 $($n)개 보냄"
  }
  Start-Sleep -Seconds 60
}
