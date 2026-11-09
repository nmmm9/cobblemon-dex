#!/bin/sh
# COBBLEVERSE 인스턴스(Modrinth)에서 도감에 필요한 파일만 raw/cv/ 로 뽑음. 그다음 node build.js
# 번호 = 게임 로딩 순서: (00 바닐라: 아이템 그림·아이템 태그만) -> 코블몬 jar -> 애드온 jar(모드 id 순) -> 코블벌스 데이터팩. 같은 경로 파일은 뒤가 덮어씀
# 모드팩 업데이트 후엔 아래 파일명(버전)만 고치고 다시 실행
P="C:/Users/MG/AppData/Roaming/ModrinthApp/profiles/COBBLEVERSE - Pokemon Adventure [Cobblemon]"
MC="C:/Users/MG/AppData/Roaming/ModrinthApp/meta/versions/1.21.1-0.18.4/1.21.1-0.18.4.jar"
OUT="$(cd "$(dirname "$0")" && pwd -W 2>/dev/null || pwd)/raw/cv"
ART='assets/*/models/item assets/*/models/block assets/*/textures/item assets/*/textures/block' # 아이템 그림 (모델 -> 텍스처)
rm -rf "$OUT"
7z x "$MC" -o"$OUT/00_minecraft" data/minecraft/tags/item $ART -r- -y >/dev/null && echo "00_minecraft ok"
n=0
for f in "mods/Cobblemon-fabric-1.7.3+1.21.1.jar" "mods/cobblemon-additions-4.1.6.jar" "mods/cobblenav-fabric-2.3.3.jar" \
  "mods/LegendaryMonuments-Cobbleverse.jar" "mods/LumyMon-0.6.6.jar" "mods/mega_showdown-fabric-1.8.4+1.7.3+1.21.1.jar" \
  "mods/tmcraft-1.4.18+1.7.3.jar" "mods/zamega-fabric-1.7.3.jar" "datapacks/COBBLEVERSE-DP-v31.zip"; do
  n=$((n+1)); name=$(printf "%02d_%s" $n "$(basename "$f" | sed -E 's/[-_+ ].*//')")
  7z x "$P/$f" -o"$OUT/$name" data "assets/*/lang/ko_kr.json" "assets/*/lang/en_us.json" $ART -r- -y >/dev/null && echo "$name ok"
done
