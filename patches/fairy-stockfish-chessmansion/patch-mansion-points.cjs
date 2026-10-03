// 체스맨션 Fairy-Stockfish 패치 2 — patch-mansion.cjs 다음에 적용. chessmansion-oss 저장소에도 같이 올림.
// 포인트 규칙(2026-10-02) + 무진전 20수 (캐슬링은 맨션 쪽·룩 쪽 둘 다 — patch-mansion.cjs 그대로. 2026-10-02에
// 룩 쪽만으로 바꿨다가 2026-10-03에 되돌림):
//  - 포인트 상한 productionPointCap(기본 없음 — 체스맨션도 상한 없음. 상한 10을 실험했다가 백의 선수 이점이 사라져서 뺌)
//  - 맨션이 잡히면 잡힌 쪽 포인트는 즉시 0, 맨션이 없는 쪽은 포인트가 쌓이지 않음
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, 'fairy-stockfish.wasm', 'src');

function rep(file, a, b) {
    const p = path.join(src, file);
    let s = fs.readFileSync(p, 'utf8');
    if (s.includes(b)) return; // 이미 적용됨
    if (!s.includes(a)) throw new Error(`patch target not found in ${file}: ${a.slice(0, 80)}`);
    s = s.replace(a, b);
    fs.writeFileSync(p, s);
}

rep('variant.h', '  int productionPointValue = 0;\n', '  int productionPointValue = 0;\n  int productionPointCap = 1000;\n');

// 맨션이 있을 때만 +1, 상한까지
rep(
    'position.cpp',
    `      else
          st->productionPoints[us] += 1;`,
    `      else if (pieces(us, production_piece()))
          st->productionPoints[us] = std::min(st->productionPoints[us] + 1, var->productionPointCap);`,
);
// 상대 맨션을 잡으면 상대 포인트 0
rep(
    'position.cpp',
    `  // Update the key with the final value
  st->key = k;
  // Calculate checkers bitboard (if move gives check)`,
    `  // 체스맨션: 맨션을 잃은 쪽 포인트는 0
  if (   production_piece() != NO_PIECE_TYPE && captured && color_of(captured) == them
      && type_of(captured) == production_piece() && st->productionPoints[them])
  {
      k ^=  Zobrist::production[them][std::min(st->productionPoints[them], 63)]
          ^ Zobrist::production[them][0];
      st->productionPoints[them] = 0;
  }

  // Update the key with the final value
  st->key = k;
  // Calculate checkers bitboard (if move gives check)`,
);



// ---- 2026-10-02 규칙 수정: 무진전 무승부 20수(40플라이) ----
rep('variant.cpp', '        v->nMoveRule = 10;\n', '        v->nMoveRule = 20;\n');
console.log('chessmansion points patch applied');
