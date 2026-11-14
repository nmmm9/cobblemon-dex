#!/bin/sh
# COBBLEVERSE 인스턴스(Modrinth)에서 도감에 필요한 파일만 raw/cv/ 로 뽑음. 그다음 node build.js
# 번호 = 게임 로딩 순서: (00 바닐라: 아이템 그림·아이템 태그·제작법·드롭 표만) -> 코블몬 jar -> 애드온 jar(모드 id 순) -> 코블벌스 데이터팩. 같은 경로 파일은 뒤가 덮어씀
# 모드팩 업데이트 후엔 아래 파일명(버전)만 고치고 다시 실행
P="C:/Users/MG/AppData/Roaming/ModrinthApp/profiles/COBBLEVERSE - Pokemon Adventure [Cobblemon]"
MC="C:/Users/MG/AppData/Roaming/ModrinthApp/meta/versions/1.21.1-0.18.4/1.21.1-0.18.4.jar"
OUT="$(cd "$(dirname "$0")" && pwd -W 2>/dev/null || pwd)/raw/cv"
ART='assets/*/models/item assets/*/models/block assets/*/textures/item assets/*/textures/block' # 아이템 그림 (모델 -> 텍스처)
rm -rf "$OUT"
7z x "$MC" -o"$OUT/00_minecraft" data/minecraft/tags/item data/minecraft/recipe data/minecraft/loot_table $ART -r- -y >/dev/null && echo "00_minecraft ok"
n=0
for f in "mods/Cobblemon-fabric-1.7.3+1.21.1.jar" "mods/cobblemon-additions-4.1.6.jar" "mods/cobblenav-fabric-2.3.3.jar" \
  "mods/comforts-fabric-9.0.5+1.21.1.jar" "mods/LegendaryMonuments-Cobbleverse.jar" "mods/LumyMon-0.6.6.jar" "mods/mega_showdown-fabric-1.8.4+1.7.3+1.21.1.jar" \
  "mods/Only Bottle Caps-1.3.0.jar" "mods/rctmod-fabric-1.21.1-0.18.1-beta.jar" "mods/sophisticatedbackpacks-1.21.1-3.23.4.3.106.jar" \
  "mods/tmcraft-1.4.18+1.7.3.jar" "mods/toms_storage_fabric-1.21-2.3.0.jar" "mods/waystones-fabric-1.21.1-21.1.37.jar" \
  "mods/zamega-fabric-1.7.3.jar" "datapacks/COBBLEVERSE-DP-v31.zip" "datapacks/COBBLEVERSE-Loot-DP-v11.zip" "datapacks/COBBLEVERSE-RCT-DP-v20.zip"; do
  n=$((n+1)); name=$(printf "%02d_%s" $n "$(basename "$f" | sed -E 's/[-_+ ].*//')")
  7z x "$P/$f" -o"$OUT/$name" data "assets/*/lang/ko_kr.json" "assets/*/lang/en_us.json" $ART -r- -y >/dev/null && echo "$name ok"
done
# 지방 추가 데이터팩 (관동 챔피언 이후 차례로 켜짐): 전설 탭의 구조물·조합법 용도로만 raw/cvx/ 에 따로 둠. 다른 탭 데이터에는 안 섞임
n=0
rm -rf "$OUT/../cvx"
for r in Johto Hoenn Sinnoh; do
  n=$((n+1)); 7z x "$P/datapacks/extra/COBBLEVERSE-$r-DP.zip" -o"$OUT/../cvx/${n}_$r" data -r- -y >/dev/null && echo "cvx/${n}_$r ok"
done
# 폼(메가·리전폼 등) 그림 번호: PokeAPI 의 포켓몬 목록. build.js 가 폼 키와 맞춰 그림 주소를 만듦
mkdir -p "$OUT/../pokeapi" && curl -sS -m 60 -o "$OUT/../pokeapi/pokemon.csv" "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon.csv" && echo "pokeapi ok"
# 모드팩이 없앤 바닐라 몹 목록 (MobsBeGone): build.js 가 그 몹 드롭을 얻는 곳에서 뺌
cp "$P/config/mobsbegone-blacklist.json" "$OUT/../" && echo "mobsbegone ok"
# 지도 아이콘: 미니맵(Xaero)에 뜨는 픽셀 그림 (E19 Cobblemon Minimap Icons 리소스팩). build.js 가 도감 키와 맞춰 img/map/ 으로 복사
rm -rf "$OUT/../mapicon" && 7z e "$P/resourcepacks/E19 Cobblemon Minimap Icons.zip" -o"$OUT/../mapicon" 'assets/xaerominimap/entity/icon/sprite/regular/*' -y >/dev/null && echo "mapicon ok"
