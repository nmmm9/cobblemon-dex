# 코블버스 포켓몬 동기화 (방장 PC용)
# 월드 폴더(level.dat 있는 곳)에 이 파일과 cobble-sync.bat을 넣고 bat을 더블클릭.
# 월드 파일은 읽기만 하고, 지정한 플레이어 한 명의 코블몬 저장 파일만 구글 드라이브 폴더로 복사한다.
$world = $PSScriptRoot
if (-not (Test-Path (Join-Path $world 'level.dat'))) {
  Write-Host '이 파일을 월드 폴더(level.dat 있는 곳)에 넣고 다시 실행해줘.'
  Read-Host '엔터 누르면 닫혀'; exit
}

$cfgPath = Join-Path $world 'cobble-sync.cfg.json'
$cfg = $null
if (Test-Path $cfgPath) { $cfg = Get-Content $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json }
if (-not $cfg) {
  $name = Read-Host '데이터 보낼 친구의 마인크래프트 닉네임'
  $uuid = $null
  $cache = Join-Path (Split-Path (Split-Path $world)) 'usercache.json'
  if (Test-Path $cache) {
    $u = Get-Content $cache -Raw -Encoding UTF8 | ConvertFrom-Json | Where-Object { $_.name -eq $name } | Select-Object -First 1
    if ($u) { $uuid = $u.uuid }
  }
  if (-not $uuid) { $uuid = Read-Host '닉네임으로 못 찾았어. 친구 UUID를 직접 입력해줘 (하이픈 포함)' }

  $dest = $null
  foreach ($d in Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue) {
    foreach ($n in '내 드라이브', 'My Drive') {
      $p = Join-Path $d.Root "$n\cobble-sync"
      if (Test-Path $p -ErrorAction SilentlyContinue) { $dest = $p }
    }
  }
  if (-not $dest) { $dest = Read-Host '구글 드라이브 cobble-sync 폴더 경로 (예: G:\내 드라이브\cobble-sync)' }

  $cfg = [pscustomobject]@{ uuid = $uuid.Trim().ToLower(); dest = $dest.Trim('"', ' ') }
  $cfg | ConvertTo-Json | Set-Content $cfgPath -Encoding UTF8
}

Write-Host "월드: $world"
Write-Host "대상: $($cfg.uuid)"
Write-Host "보내는 곳: $($cfg.dest)"
Write-Host '게임하는 동안 이 창을 켜 둬. (설정 다시 하려면 cobble-sync.cfg.json 지우기)'

# 바닐라 플레이어 파일(인벤토리·통계·발전과제)은 빼고 코블몬 파일만
$skip = '\\(playerdata|stats|advancements)\\'
$sent = @{}
while ($true) {
  $n = 0
  Get-ChildItem $world -Recurse -File -Filter "*$($cfg.uuid)*" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch $skip } | ForEach-Object {
    $key = "$($_.Length)|$($_.LastWriteTimeUtc.Ticks)"
    if ($sent[$_.FullName] -eq $key) { return }
    $rel = $_.FullName.Substring($world.Length).TrimStart('\')
    $to = Join-Path $cfg.dest $rel
    try {
      New-Item -ItemType Directory -Force (Split-Path $to) | Out-Null
      Copy-Item $_.FullName "$to.tmp" -Force -ErrorAction Stop
      Move-Item "$to.tmp" $to -Force -ErrorAction Stop
      $sent[$_.FullName] = $key; $n++
    } catch { }  # 게임이 쓰는 중이면 다음 바퀴에 다시
  }
  if ($n) { Write-Host "[$(Get-Date -Format HH:mm:ss)] 파일 $n개 보냄" }
  Start-Sleep -Seconds 300
}
