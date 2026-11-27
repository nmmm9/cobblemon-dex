// 구글 Apps Script(script.google.com)에 붙여 넣고 웹 앱으로 배포.
// cobble-sync 폴더(ID 고정) 안의 코블몬 저장 파일(.dat .nbt .json, 1MB 이하)만 base64로 묶어 돌려줌
// -> 도감 "내 포켓몬" 탭이 1분마다 읽음. 다른 파일은 폴더에 있어도 안 내보냄.
const FOLDER_ID = '1Z_O6Tc31qAtCFbzxePKG_LgnE1Ux42Xv';
function doGet() {
  const out = { t: 0, files: {} };
  const walk = (folder, pre) => {
    const fs = folder.getFiles();
    while (fs.hasNext()) {
      const f = fs.next(), n = f.getName();
      if (!/\.(dat|nbt|json)$/i.test(n) || f.getSize() > 1e6) continue;
      out.files[pre + n] = Utilities.base64Encode(f.getBlob().getBytes());
      out.t = Math.max(out.t, f.getLastUpdated().getTime());
    }
    const ds = folder.getFolders();
    while (ds.hasNext()) { const d = ds.next(); walk(d, pre + d.getName() + '/'); }
  };
  walk(DriveApp.getFolderById(FOLDER_ID), '');
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
