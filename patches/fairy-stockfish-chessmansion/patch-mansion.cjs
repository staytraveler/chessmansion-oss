// 체스맨션 변형(chessmansion)을 Fairy-Stockfish에 넣는 소스 패치 — chessmansion-oss 저장소에도 같이 올림.
// 규칙: 6x6, 백 첫 줄 a→f 맨션·퀸·킹·비숍·나이트·룩(흑은 위아래 대칭), 폰 2칸 전진·앙파상·끝줄 승진.
// 맨션(m) = 가로·세로·대각선으로 정확히 2칸 뛰어넘기(Betza "AD"). 킹이 2칸 가는 캐슬링을 맨션 쪽·룩 쪽 둘 다.
// 생산: 이동(캐슬링 포함)할 때마다 그 쪽 포인트 +1, 포인트를 써서 자기 맨션 바로 옆 빈칸에 기물을 놓음
// (폰1·나이트3·비숍3·룩5·퀸9, 체크 중엔 불가, 폰은 끝줄에 못 놓음). 생산은 무진전 카운터를 리셋하지 않음.
// 무진전 무승부 수는 patch-mansion-points.cjs에서 20수(40플라이)로 바꿈.
//
// 엔진에서의 구현: 생산 = 손에 든 기물 없이 놓는 착수(freeDrops)로 표현하고, 놓을 수 있는 칸·종류를
// 포인트와 맨션 위치로 제한(drop_region). 포인트는 StateInfo에 담아 수를 둘 때마다 갱신하고 해시 키에도 반영.
// FEN 끝에 "백포인트 흑포인트"를 붙여서 주고받음(예: "... w KQkq - 0 1 3 2").
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

// ---- variant.h: 생산 설정 ----
rep(
    'variant.h',
    '  bool freeDrops = false;\n',
    `  bool freeDrops = false;
  // 체스맨션 생산: productionPiece 옆 칸에만, productionCost만큼 포인트를 써서 놓을 수 있음(0 = 생산 불가 종류)
  PieceType productionPiece = NO_PIECE_TYPE;
  int productionCost[PIECE_TYPE_NB] = {};
  int productionPointValue = 0;
`,
);

// ---- position.h: 포인트 상태 ----
rep(
    'position.h',
    '  Bitboard gatesBB[COLOR_NB];\n\n  // Not copied',
    '  Bitboard gatesBB[COLOR_NB];\n  int    productionPoints[COLOR_NB];\n\n  // Not copied',
);

rep(
    'position.h',
    '  bool piece_drops() const;\n',
    `  bool piece_drops() const;
  PieceType production_piece() const;
  int production_points(Color c) const;
  int production_cost(PieceType pt) const;
  Bitboard production_squares(Color c) const;
`,
);

rep(
    'position.h',
    'inline bool Position::piece_drops() const {',
    `inline PieceType Position::production_piece() const {
  return var->productionPiece;
}

inline int Position::production_points(Color c) const {
  return st->productionPoints[c];
}

inline int Position::production_cost(PieceType pt) const {
  return var->productionCost[pt];
}

// 생산할 수 있는 칸 = 자기 맨션 8방향 바로 옆(빈칸 여부는 호출하는 쪽에서 거름)
inline Bitboard Position::production_squares(Color c) const {
  Bitboard adj = 0;
  Bitboard m = pieces(c, var->productionPiece);
  while (m)
      adj |= PseudoAttacks[WHITE][KING][pop_lsb(m)];
  return adj;
}

inline bool Position::piece_drops() const {`,
);

rep(
    'position.h',
    `inline Bitboard Position::drop_region(Color c, PieceType pt) const {
  Bitboard b = drop_region(c) & board_bb(c, pt);
`,
    `inline Bitboard Position::drop_region(Color c, PieceType pt) const {
  Bitboard b = drop_region(c) & board_bb(c, pt);

  // 체스맨션 생산: 포인트가 모자라거나, 생산 못 하는 종류거나, 체크 중이면 놓을 칸이 없음
  if (var->productionPiece != NO_PIECE_TYPE)
  {
      int cost = var->productionCost[pt];
      if (!cost || cost > st->productionPoints[c] || (c == sideToMove && st->checkersBB))
          return Bitboard(0);
      b &= production_squares(c);
  }
`,
);

// ---- position.cpp: 해시 키 ----
rep('position.cpp', '  Key endgame[EG_EVAL_NB];\n}', '  Key endgame[EG_EVAL_NB];\n  Key production[COLOR_NB][64];\n}');

rep(
    'position.cpp',
    '  Zobrist::noPawns = rng.rand<Key>();\n',
    `  Zobrist::noPawns = rng.rand<Key>();
  for (Color c : {WHITE, BLACK})
      for (int n = 0; n < 64; ++n)
          Zobrist::production[c][n] = rng.rand<Key>();
`,
);

rep(
    'position.cpp',
    `  if (check_counting())
      for (Color c : {WHITE, BLACK})
          si->key ^= Zobrist::checks[c][si->checksRemaining[c]];
}`,
    `  if (check_counting())
      for (Color c : {WHITE, BLACK})
          si->key ^= Zobrist::checks[c][si->checksRemaining[c]];

  if (production_piece() != NO_PIECE_TYPE)
      for (Color c : {WHITE, BLACK})
          si->key ^= Zobrist::production[c][std::min(si->productionPoints[c], 63)];
}`,
);

// ---- position.cpp: FEN 읽기/쓰기(끝에 "백포인트 흑포인트") ----
rep(
    'position.cpp',
    `      ss >> std::skipws >> st->rule50 >> gamePly;

      // Convert from fullmove starting from 1 to gamePly starting from 0,
      // handle also common incorrect FEN with fullmove = 0.
      gamePly = std::max(2 * (gamePly - 1), 0) + (sideToMove == BLACK);
`,
    `      ss >> std::skipws >> st->rule50 >> gamePly;

      // Convert from fullmove starting from 1 to gamePly starting from 0,
      // handle also common incorrect FEN with fullmove = 0.
      gamePly = std::max(2 * (gamePly - 1), 0) + (sideToMove == BLACK);

      // 체스맨션 생산 포인트
      if (production_piece() != NO_PIECE_TYPE)
      {
          int pw = 0, pb = 0;
          if (ss >> pw >> pb)
          {
              st->productionPoints[WHITE] = std::max(pw, 0);
              st->productionPoints[BLACK] = std::max(pb, 0);
          }
      }
`,
);

rep(
    'position.cpp',
    `  ss << " " << 1 + (gamePly - (sideToMove == BLACK)) / 2;

  return ss.str();`,
    `  ss << " " << 1 + (gamePly - (sideToMove == BLACK)) / 2;

  if (production_piece() != NO_PIECE_TYPE)
      ss << " " << st->productionPoints[WHITE] << " " << st->productionPoints[BLACK];

  return ss.str();`,
);

// ---- position.cpp: 수를 둘 때 포인트 갱신 ----
rep(
    'position.cpp',
    `  if (type_of(m) == DROP)
  {
      Piece pc_hand = make_piece(us, in_hand_piece_type(m));
      k ^=  Zobrist::psq[pc][to]
          ^ Zobrist::inHand[pc_hand][pieceCountInHand[color_of(pc_hand)][type_of(pc_hand)] - 1]
          ^ Zobrist::inHand[pc_hand][pieceCountInHand[color_of(pc_hand)][type_of(pc_hand)]];

      // Reset rule 50 counter for irreversible drops
      st->rule50 = 0;
  }`,
    `  if (production_piece() != NO_PIECE_TYPE)
  {
      // 체스맨션: 생산하면 비용만큼 차감, 그 밖의 모든 수(캐슬링 포함)는 +1
      int before = st->productionPoints[us];
      if (type_of(m) == DROP)
          st->productionPoints[us] -= production_cost(in_hand_piece_type(m));
      else
          st->productionPoints[us] += 1;
      k ^=  Zobrist::production[us][std::min(before, 63)]
          ^ Zobrist::production[us][std::min(st->productionPoints[us], 63)];
  }

  if (type_of(m) == DROP && production_piece() != NO_PIECE_TYPE)
      // 생산은 손에 든 기물이 없고, 무진전 카운터도 리셋하지 않음
      k ^= Zobrist::psq[pc][to];
  else if (type_of(m) == DROP)
  {
      Piece pc_hand = make_piece(us, in_hand_piece_type(m));
      k ^=  Zobrist::psq[pc][to]
          ^ Zobrist::inHand[pc_hand][pieceCountInHand[color_of(pc_hand)][type_of(pc_hand)] - 1]
          ^ Zobrist::inHand[pc_hand][pieceCountInHand[color_of(pc_hand)][type_of(pc_hand)]];

      // Reset rule 50 counter for irreversible drops
      st->rule50 = 0;
  }`,
);

// ---- evaluate.cpp: 포인트 가치 ----
rep(
    'evaluate.cpp',
    `  // Damp down the evaluation linearly when shuffling
  if (pos.n_move_rule())`,
    `  // 체스맨션: 보유 포인트 차이(둘 차례 기준)
  if (pos.production_piece() != NO_PIECE_TYPE)
  {
      Color us = pos.side_to_move();
      v += (pos.production_points(us) - pos.production_points(~us)) * pos.variant()->productionPointValue;
  }

  // Damp down the evaluation linearly when shuffling
  if (pos.n_move_rule())`,
);

// ---- variant.cpp: chessmansion 변형 ----
rep(
    'variant.cpp',
    '    // Almost chess\n',
    `    // ChessMansion (체스맨션) — chessmansion.com
    Variant* chessmansion_variant() {
        Variant* v = chess_variant_base()->init();
        v->maxRank = RANK_6;
        v->maxFile = FILE_F;
        v->add_piece(CUSTOM_PIECE_1, 'm', "AD");
        v->pieceValue[MG][CUSTOM_PIECE_1] = 2600;
        v->pieceValue[EG][CUSTOM_PIECE_1] = 2600;
        v->startFen = "mqkbnr/pppppp/6/6/PPPPPP/MQKBNR w KQkq - 0 1 0 0";
        v->promotionRegion[WHITE] = Rank6BB;
        v->promotionRegion[BLACK] = Rank1BB;
        v->doubleStepRegion[WHITE] = Rank2BB;
        v->doubleStepRegion[BLACK] = Rank5BB;
        v->castlingKingFile = FILE_C;
        v->castlingKingsideFile = FILE_E;
        v->castlingQueensideFile = FILE_A;
        v->castlingRookKingsideFile = FILE_F;
        v->castlingRookQueensideFile = FILE_A;
        v->castlingRookPieces[WHITE] = v->castlingRookPieces[BLACK] = piece_set(ROOK) | CUSTOM_PIECE_1;
        v->pieceDrops = true;
        v->freeDrops = true;
        v->firstRankPawnDrops = true;
        v->promotionZonePawnDrops = false;
        v->productionPiece = CUSTOM_PIECE_1;
        v->productionCost[PAWN] = 1;
        v->productionCost[KNIGHT] = 3;
        v->productionCost[BISHOP] = 3;
        v->productionCost[ROOK] = 5;
        v->productionCost[QUEEN] = 9;
        v->productionPointValue = 60;
        v->nMoveRule = 10;
        return v;
    }
    // Almost chess\n`,
);

rep('variant.cpp', '    add("gardner", gardner_variant());\n', '    add("gardner", gardner_variant());\n    add("chessmansion", chessmansion_variant());\n');

console.log('chessmansion patch applied');

// ---- ucioption.cpp: 맨션 가치·포인트 가치를 엔진 설정으로 바꿀 수 있게(엔진끼리 비교 대국용) ----
rep(
    'ucioption.cpp',
    'void on_variant_set(const Option &o) {',
    `// 체스맨션: 맨션 기물 가치(MansionValue)·포인트 1점 가치(MansionPointValue) 조정
void on_mansion_value(const Option&) {
    auto it = variants.find("chessmansion");
    if (it == variants.end())
        return;
    Variant* v = const_cast<Variant*>(it->second);
    v->pieceValue[MG][CUSTOM_PIECE_1] = v->pieceValue[EG][CUSTOM_PIECE_1] = int(Options["MansionValue"]);
    v->productionPointValue = int(Options["MansionPointValue"]);
    if (std::string(Options["UCI_Variant"]) == "chessmansion")
        PSQT::init(v);
}
void on_variant_set(const Option &o) {`,
);
rep(
    'ucioption.cpp',
    '  o["UCI_Variant"]           << Option("chess", variants.get_keys(), on_variant_change);\n',
    `  o["UCI_Variant"]           << Option("chess", variants.get_keys(), on_variant_change);
  o["MansionValue"]          << Option(2600, 0, 10000, on_mansion_value);
  o["MansionPointValue"]     << Option(60, 0, 2000, on_mansion_value);
`,
);

