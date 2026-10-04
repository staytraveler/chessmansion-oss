// 체스맨션 Fairy-Stockfish 패치 3 — patch-mansion.cjs, patch-mansion-points.cjs 다음에 적용. chessmansion-oss 저장소에도 같이 올림.
// 2026-10-04 7×7 개편(docs/game-mode-rules.md):
//  - 7×7, 백 1랭크 a→g: 룩·룩·맨션·킹·맨션·룩·룩, 2랭크 나이트 7개(흑은 위아래 대칭), 시작 영향력 백 0P·흑 5P, 영향력은 상대 기물을 잡을 때만(그 기물 출격 비용만큼, 맨션 0). 캐슬링 없음. 무진전 무승부 30수
//  - 맨션(m): 움직이지 않고 공격하지도 않음(잡힐 수는 있음, 길은 막음). 두 채가 영향력(포인트)을 같이 씀
//  - 출격(생산): 맨션 바로 옆 8칸 빈칸에. 체크 중엔 체크를 막는 자리에만(일반 합법성 검사로 걸러짐)
//  - 귀환: 킹 외 내 기물이 자기 움직임으로 내 맨션 칸(킹이 들어가 있으면 그 칸)에 닿으면 사라지고 출격 비용만큼 영향력.
//    폰은 앞 1칸·첫 수 2칸만. 체크 중엔 불가. 폰 귀환은 무진전 카운터 리셋
//  - 킹 귀환: 킹이 바로 옆 내 맨션 칸으로 들어감(맨션은 판에서 빠지고 킹이 그 칸에, 상태값 mansionMerged로 표시).
//    들어가 있는 킹은 바로 옆 8칸 + 둘레 16칸으로 출격(잡기 가능, 원래 칸엔 맨션이 다시 남음)하거나 반대편 맨션으로 옮김.
//    들어가 있는 동안 킹의 움직임(=공격 칸)은 보조 기물 'x'(Betza "KADN")로 계산. 체크 중에도 들어가기·옮기기 가능
//  - 맨션 두 채를 모두 잃으면 영향력 0, 이후 안 쌓임(하나만 잃으면 유지)
// 엔진 구현: 기물 귀환·킹 귀환·맨션 옮기기는 SPECIAL 수(출발칸 → 맨션 칸, UCI "e2c1"). 킹 출격은 일반 킹 이동.
// FEN 끝에 "백영향력 흑영향력 백킹귀환 흑킹귀환"(0/1).
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, 'fairy-stockfish.wasm', 'src');

function rep(file, a, b, all = false) {
    const p = path.join(src, file);
    let s = fs.readFileSync(p, 'utf8');
    if (!s.includes(a)) {
        if (s.includes(b)) return; // 이미 적용됨
        throw new Error(`patch target not found in ${file}: ${a.slice(0, 80)}`);
    }
    s = all ? s.split(a).join(b) : s.replace(a, b);
    fs.writeFileSync(p, s);
}

// ---- variant.cpp: 7×7 체스맨션 ----
rep('variant.cpp', `        v->maxRank = RANK_6;
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
`, `        v->maxRank = RANK_7;
        v->maxFile = FILE_G;
        // 맨션: 움직이지 않음(이동 규칙 없음)
        v->add_piece(CUSTOM_PIECE_1, 'm', "");
        v->pieceValue[MG][CUSTOM_PIECE_1] = 1000;
        v->pieceValue[EG][CUSTOM_PIECE_1] = 1000;
        // 맨션에 들어가 있는 킹의 움직임 표(판에 놓이지 않는 보조 기물): 바로 옆 8칸 + 둘레 16칸
        v->add_piece(CUSTOM_PIECE_2, 'x', "KADN");
        v->pieceValue[MG][CUSTOM_PIECE_2] = v->pieceValue[EG][CUSTOM_PIECE_2] = 0;
        v->mergedKingType = CUSTOM_PIECE_2;
        v->startFen = "rrmkmrr/nnnnnnn/7/7/7/NNNNNNN/RRMKMRR w - - 0 1 0 5 0 0";
        v->promotionRegion[WHITE] = Rank7BB;
        v->promotionRegion[BLACK] = Rank1BB;
        v->doubleStepRegion[WHITE] = Rank2BB;
        v->doubleStepRegion[BLACK] = Rank6BB;
        v->castling = false;
`);
rep('variant.cpp', '        v->nMoveRule = 20;\n        return v;', '        v->nMoveRule = 30;\n        return v;');

// ---- variant.h ----
rep('variant.h', '  PieceType productionPiece = NO_PIECE_TYPE;\n',
    '  PieceType productionPiece = NO_PIECE_TYPE;\n  // 맨션에 들어가 있는 킹의 움직임(보조 기물 종류)\n  PieceType mergedKingType = NO_PIECE_TYPE;\n');

// ---- position.h: 상태값·도우미 ----
rep('position.h', '  int    productionPoints[COLOR_NB];\n\n  // Not copied',
    '  int    productionPoints[COLOR_NB];\n  bool   mansionMerged[COLOR_NB];\n\n  // Not copied');
rep('position.h', '  int production_points(Color c) const;\n',
    '  int production_points(Color c) const;\n  bool mansion_merged(Color c) const;\n  bool mansion_special(Move m) const;\n  bool has_mansion(Color c) const;\n  PieceType king_type(Color c) const;\n');
rep('position.h', 'inline int Position::production_points(Color c) const {\n  return st->productionPoints[c];\n}\n',
    `inline int Position::production_points(Color c) const {
  return st->productionPoints[c];
}

// 킹이 맨션에 들어가 있는지(킹 칸 = 맨션 칸)
inline bool Position::mansion_merged(Color c) const {
  return st->mansionMerged[c];
}

// 맨션이 하나라도 남아 있는지(킹이 들어가 있는 맨션 포함)
inline bool Position::has_mansion(Color c) const {
  return pieces(c, var->productionPiece) || st->mansionMerged[c];
}

// 기물 귀환·킹 귀환·맨션 옮기기(SPECIAL, 출발칸 → 내 맨션 칸)
inline bool Position::mansion_special(Move m) const {
  return var->productionPiece != NO_PIECE_TYPE && type_of(m) == SPECIAL && from_sq(m) != to_sq(m);
}

// 맨션에 들어가 있는 킹은 바로 옆 8칸 + 둘레 16칸으로 움직임(출격)
inline PieceType Position::king_type(Color c) const {
  return var->mergedKingType != NO_PIECE_TYPE && st->mansionMerged[c] ? var->mergedKingType : var->kingType;
}
`);
rep('position.h', '  PieceType movePt = pt == KING ? king_type() : pt;\n', '  PieceType movePt = pt == KING ? king_type(c) : pt;\n', true);

// 출격 칸: 맨션(킹이 들어간 맨션 포함) 바로 옆 8칸. 체크 중 제한은 없앰(체크를 막는 출격만 합법성 검사를 통과)
rep('position.h', `      if (!cost || cost > st->productionPoints[c] || (c == sideToMove && st->checkersBB))
          return Bitboard(0);`, `      if (!cost || cost > st->productionPoints[c])
          return Bitboard(0);`);
rep('position.h', `  while (m)
      adj |= PseudoAttacks[WHITE][KING][pop_lsb(m)];
  return adj;`, `  while (m)
      adj |= PseudoAttacks[WHITE][KING][pop_lsb(m)];
  if (st->mansionMerged[c] && count<KING>(c))
      adj |= PseudoAttacks[WHITE][KING][square<KING>(c)];
  return adj;`);

// 귀환·킹 귀환은 도착칸에 내 맨션이 있지만 잡기가 아님
rep('position.h', '  return type_of(m) == PROMOTION || type_of(m) == EN_PASSANT || (type_of(m) != CASTLING && !empty(to_sq(m)));\n',
    '  return type_of(m) == PROMOTION || type_of(m) == EN_PASSANT || (type_of(m) != CASTLING && !empty(to_sq(m)) && !mansion_special(m));\n');
rep('position.h', '  return (!empty(to_sq(m)) && type_of(m) != CASTLING && from_sq(m) != to_sq(m)) || type_of(m) == EN_PASSANT;\n',
    '  return (!empty(to_sq(m)) && type_of(m) != CASTLING && from_sq(m) != to_sq(m) && !mansion_special(m)) || type_of(m) == EN_PASSANT;\n');

// ---- position.cpp: 해시 키 ----
rep('position.cpp', '  Key production[COLOR_NB][64];\n', '  Key production[COLOR_NB][64];\n  Key mansionMerged[COLOR_NB];\n');
rep('position.cpp', `          Zobrist::production[c][n] = rng.rand<Key>();
`, `          Zobrist::production[c][n] = rng.rand<Key>();
  for (Color c : {WHITE, BLACK})
      Zobrist::mansionMerged[c] = rng.rand<Key>();
`);
rep('position.cpp', `  if (production_piece() != NO_PIECE_TYPE)
      for (Color c : {WHITE, BLACK})
          si->key ^= Zobrist::production[c][std::min(si->productionPoints[c], 63)];
}`, `  if (production_piece() != NO_PIECE_TYPE)
      for (Color c : {WHITE, BLACK})
      {
          si->key ^= Zobrist::production[c][std::min(si->productionPoints[c], 63)];
          if (si->mansionMerged[c])
              si->key ^= Zobrist::mansionMerged[c];
      }
}`);

// ---- position.cpp: FEN 끝에 킹 귀환 여부 ----
rep('position.cpp', `              st->productionPoints[BLACK] = std::max(pb, 0);
          }`, `              st->productionPoints[BLACK] = std::max(pb, 0);
              int mw = 0, mb = 0;
              if (ss >> mw >> mb)
              {
                  st->mansionMerged[WHITE] = mw != 0;
                  st->mansionMerged[BLACK] = mb != 0;
              }
          }`);
rep('position.cpp', '      ss << " " << st->productionPoints[WHITE] << " " << st->productionPoints[BLACK];\n',
    '      ss << " " << st->productionPoints[WHITE] << " " << st->productionPoints[BLACK]\n         << " " << int(st->mansionMerged[WHITE]) << " " << int(st->mansionMerged[BLACK]);\n');

// ---- position.cpp: 체크 칸·공격 계산에 색마다 킹 움직임 ----
rep('position.cpp', `      PieceType movePt = pt == KING ? king_type() : pt;
      si->checkSquares[pt] = ksq != SQ_NONE ? attacks_bb(~sideToMove, movePt, ksq, pieces()) : Bitboard(0);`,
    `      PieceType movePt = pt == KING ? (var->mergedKingType != NO_PIECE_TYPE && si->mansionMerged[sideToMove] ? var->mergedKingType : king_type()) : pt;
      si->checkSquares[pt] = ksq != SQ_NONE ? attacks_bb(~sideToMove, movePt, ksq, pieces()) : Bitboard(0);`);
rep('position.cpp', '          PieceType move_pt = pt == KING ? king_type() : pt;\n', '          PieceType move_pt = pt == KING ? king_type(c) : pt;\n');

// ---- position.cpp: 영향력 +1(맨션이 남아 있을 때, 출격 제외) ----
rep('position.cpp', '      else if (pieces(us, production_piece()))\n', '      else if (has_mansion(us))\n');
// 맨션 두 채를 모두 잃었을 때만 0
rep('position.cpp', `      && type_of(captured) == production_piece() && st->productionPoints[them])`,
    `      && type_of(captured) == production_piece() && st->productionPoints[them] && !has_mansion(them))`);

// ---- position.cpp: legal ----
rep('position.cpp', `  assert(board_bb() & to);

  // Illegal checks`, `  assert(board_bb() & to);

  // 체스맨션 SPECIAL 수
  if (mansion_special(m))
  {
      if (type_of(moved_piece(m)) == KING)
          // 킹 귀환(밖 → 맨션: 출발칸이 빔) / 맨션 옮기기(안 → 다른 맨션: 출발칸에 맨션이 남음). 도착 맨션 칸이 안전해야 함
          return !(attackers_to(to, st->mansionMerged[us] ? pieces() : pieces() ^ from, ~us) & pieces(~us));
      // 기물 귀환: 체크 중엔 불가, 핀 걸린 기물은 불가(사라지므로)
      if (checkers())
          return false;
      return !count<KING>(us) || !(blockers_for_king(us) & from);
  }

  // Illegal checks`);
rep('position.cpp', `  if (type_of(moved_piece(m)) == KING)
      return !attackers_to(to, occupied, ~us);`, `  if (type_of(moved_piece(m)) == KING)
      // 체스맨션: 맨션에서 출격하는 킹이면 출발칸에 맨션이 다시 남아 길을 막음
      return !attackers_to(to, occupied | (production_piece() != NO_PIECE_TYPE && st->mansionMerged[us] ? square_bb(from) : Bitboard(0)), ~us);`);

// ---- position.cpp: gives_check(SPECIAL) ----
rep('position.cpp', `  Square from = from_sq(m);
  Square to = to_sq(m);

  // No check possible without king
  if (!count<KING>(~sideToMove))
      return false;
`, `  Square from = from_sq(m);
  Square to = to_sq(m);

  // No check possible without king
  if (!count<KING>(~sideToMove))
      return false;

  // 체스맨션 SPECIAL 수: 열린 체크 + (킹이 맨션에 들어가면) 들어간 킹의 출격 칸 공격
  if (mansion_special(m))
  {
      Square theirKing = square<KING>(~sideToMove);
      bool kingMove = type_of(moved_piece(m)) == KING;
      Bitboard occ = kingMove && st->mansionMerged[sideToMove] ? pieces() : pieces() ^ from;
      Bitboard others = pieces(sideToMove) & ~pieces(sideToMove, KING) & ~square_bb(from);
      if (attackers_to(theirKing, occ, sideToMove) & others)
          return true;
      if (kingMove)
          return PseudoAttacks[sideToMove][var->mergedKingType][to] & theirKing;
      return st->mansionMerged[sideToMove] && (attacks_bb(sideToMove, var->mergedKingType, square<KING>(sideToMove), occ) & theirKing);
  }
`);

// ---- position.cpp: do_move ----
rep('position.cpp', `  st->pass = is_pass(m);

  assert(color_of(pc) == us);`, `  st->pass = is_pass(m);

  // 체스맨션 SPECIAL 수: 기물 귀환 / 킹 귀환(밖 → 맨션) / 맨션 옮기기(안 → 다른 맨션)
  if (mansion_special(m))
  {
      int before = st->productionPoints[us];
      Piece mansionPc = make_piece(us, production_piece());
      if (type_of(pc) == KING)
      {
          bool transfer = st->mansionMerged[us];
          st->capturedPiece = mansionPc;
          st->capturedpromoted = false;
          st->unpromotedCapturedPiece = NO_PIECE;
          // 도착 맨션을 판에서 빼고 킹을 그 칸으로
          k ^= Zobrist::psq[mansionPc][to];
          remove_piece(to);
          move_piece(from, to);
          k ^= Zobrist::psq[pc][from] ^ Zobrist::psq[pc][to];
          if (transfer)
          {
              // 떠난 맨션은 그 자리에 다시 남음
              put_piece(mansionPc, from);
              k ^= Zobrist::psq[mansionPc][from];
          }
          else
          {
              st->nonPawnMaterial[us] -= PieceValue[MG][mansionPc];
              st->materialKey ^= Zobrist::psq[mansionPc][pieceCount[mansionPc]];
              st->mansionMerged[us] = true;
              k ^= Zobrist::mansionMerged[us];
          }
          st->productionPoints[us] += 1;
      }
      else
      {
          st->capturedPiece = pc;
          st->capturedpromoted = is_promoted(from);
          st->unpromotedCapturedPiece = unpromoted_piece_on(from);
          st->productionPoints[us] += production_cost(type_of(pc)) + 1;
          if (type_of(pc) == PAWN)
          {
              st->pawnKey ^= Zobrist::psq[pc][from];
              st->rule50 = 0;
          }
          else
              st->nonPawnMaterial[us] -= PieceValue[MG][pc];
          k ^= Zobrist::psq[pc][from];
          remove_piece(from);
          st->materialKey ^= Zobrist::psq[pc][pieceCount[pc]];
      }
      k ^=  Zobrist::production[us][std::min(before, 63)]
          ^ Zobrist::production[us][std::min(st->productionPoints[us], 63)];

      while (st->epSquares)
          k ^= Zobrist::enpassant[file_of(pop_lsb(st->epSquares))];

      st->key = k;
      st->checkersBB = count<KING>(them) ? attackers_to(square<KING>(them), us) & pieces(us) : Bitboard(0);
      sideToMove = ~sideToMove;
      set_check_info(st);

      st->repetition = 0;
      int end = std::min(st->rule50, st->pliesFromNull);
      if (end >= 4)
      {
          StateInfo* stp = st->previous->previous;
          for (int i = 4; i <= end; i += 2)
          {
              stp = stp->previous->previous;
              if (stp->key == st->key)
              {
                  st->repetition = stp->repetition ? -i : i;
                  break;
              }
          }
      }
      return;
  }

  assert(color_of(pc) == us);`);

// 킹 출격(맨션 안 → 밖, 일반 수): 출발칸에 맨션을 다시 놓고 귀환 상태 해제.
// 맨션 안의 킹은 공격 칸이 달라서 체크 여부는 수를 둔 뒤 직접 계산함
rep('position.cpp', `      move_piece(from, to);
  }

  // If the moving piece is a pawn do some special extra work`, `      move_piece(from, to);

      if (production_piece() != NO_PIECE_TYPE && type_of(pc) == KING && st->mansionMerged[us])
      {
          Piece mansionPc = make_piece(us, production_piece());
          put_piece(mansionPc, from);
          k ^= Zobrist::psq[mansionPc][from];
          st->nonPawnMaterial[us] += PieceValue[MG][mansionPc];
          st->materialKey ^= Zobrist::psq[mansionPc][pieceCount[mansionPc] - 1];
          st->mansionMerged[us] = false;
          k ^= Zobrist::mansionMerged[us];
      }
  }

  // If the moving piece is a pawn do some special extra work`);
rep('position.cpp', `  st->checkersBB = givesCheck ? attackers_to(square<KING>(them), us) & pieces(us) : Bitboard(0);
  assert(givesCheck == bool(st->checkersBB));`, `  st->checkersBB = givesCheck || (production_piece() != NO_PIECE_TYPE && count<KING>(them))
                   ? attackers_to(square<KING>(them), us) & pieces(us) : Bitboard(0);`);

// ---- position.cpp: undo_move ----
rep('position.cpp', `  Piece pc = piece_on(to);

  assert(type_of(m) == DROP || empty(from) || type_of(m) == CASTLING || is_gating(m)`, `  Piece pc = piece_on(to);

  if (mansion_special(m))
  {
      if (type_of(st->capturedPiece) == production_piece())
      {
          // 킹 귀환·맨션 옮기기 되돌리기
          if (st->previous->mansionMerged[us])
              remove_piece(from);
          move_piece(to, from);
          put_piece(st->capturedPiece, to);
      }
      else
          // 기물 귀환 되돌리기
          put_piece(st->capturedPiece, from, st->capturedpromoted, st->unpromotedCapturedPiece);
      st = st->previous;
      --gamePly;
      return;
  }

  // 킹 출격 되돌리기: 출발칸에 다시 놓였던 맨션을 먼저 치움
  if (   production_piece() != NO_PIECE_TYPE && type_of(m) == NORMAL && type_of(pc) == KING
      && st->previous->mansionMerged[us] && !st->mansionMerged[us])
      remove_piece(from);

  assert(type_of(m) == DROP || empty(from) || type_of(m) == CASTLING || is_gating(m)`);

// ---- movegen.cpp: 귀환 수 생성 ----
rep('movegen.cpp', `  template<Color Us, GenType Type>
  ExtMove* generate_all(const Position& pos, ExtMove* moveList) {`, `  // 체스맨션: 기물 귀환(체크 중 제외 — 킹·맨션 외 기물이 자기 움직임으로 내 맨션 칸에 닿음, 폰은 앞 1칸·첫 수 2칸만),
  // 킹 귀환(바로 옆 내 맨션으로), 맨션 옮기기(들어가 있는 킹 → 다른 내 맨션). 킹 귀환·옮기기는 체크 중에도 생성.
  // 합법성(핀·공격받는 칸)은 legal()에서 거름
  template<Color Us>
  ExtMove* generate_mansion_specials(const Position& pos, ExtMove* moveList, bool pieceReturns) {
    bool merged = pos.mansion_merged(Us);
    Bitboard mansions = pos.pieces(Us, pos.production_piece());
    if (pieceReturns)
    {
        Bitboard targets = mansions;
        if (merged && pos.count<KING>(Us))
            targets |= pos.square<KING>(Us);
        Bitboard movers = pos.pieces(Us) & ~pos.pieces(Us, KING) & ~mansions;
        constexpr Direction Up = pawn_push(Us);
        while (targets)
        {
            Square t = pop_lsb(targets);
            for (Bitboard b = movers; b; )
            {
                Square from = pop_lsb(b);
                PieceType pt = type_of(pos.piece_on(from));
                bool reach;
                if (pt == PAWN)
                    reach =   from + Up == t
                           || ((pos.double_step_region(Us) & from) && is_ok(from + Up) && pos.empty(from + Up) && from + Up + Up == t);
                else
                    reach = pos.attacks_from(Us, pt, from) & t;
                if (reach)
                    *moveList++ = make<SPECIAL>(from, t);
            }
        }
    }
    if (pos.count<KING>(Us))
    {
        Square ksq = pos.square<KING>(Us);
        // 밖에 있으면 바로 옆 맨션으로, 들어가 있으면 다른 맨션 어디로든
        Bitboard b = merged ? mansions : (mansions & PseudoAttacks[WHITE][KING][ksq]);
        while (b)
            *moveList++ = make<SPECIAL>(ksq, pop_lsb(b));
    }
    return moveList;
  }

  template<Color Us, GenType Type>
  ExtMove* generate_all(const Position& pos, ExtMove* moveList) {`);
rep('movegen.cpp', `                    moveList = make_move_and_gating<CASTLING>(pos, moveList, Us,ksq, pos.castling_rook_square(cr));
    }

    return moveList;
  }`, `                    moveList = make_move_and_gating<CASTLING>(pos, moveList, Us,ksq, pos.castling_rook_square(cr));
    }

    // 체스맨션: 귀환(체크 중엔 킹 귀환·옮기기만)
    if (pos.production_piece() != NO_PIECE_TYPE && (Type == QUIETS || Type == NON_EVASIONS || Type == EVASIONS))
        moveList = generate_mansion_specials<Us>(pos, moveList, Type != EVASIONS);

    return moveList;
  }`);

// ---- ucioption.cpp: 맨션 가치 기본값 ----
rep('ucioption.cpp', '  o["MansionValue"]          << Option(2600, 0, 10000, on_mansion_value);\n',
    '  o["MansionValue"]          << Option(1118, 0, 10000, on_mansion_value);\n');

// ---- evaluate.cpp: 킹이 들어간 맨션도 맨션 가치로 계산 ----
rep('evaluate.cpp', "      v += (pos.production_points(us) - pos.production_points(~us)) * pos.variant()->productionPointValue;\n  }", "      v += (pos.production_points(us) - pos.production_points(~us)) * pos.variant()->productionPointValue;\n      // 킹이 들어가 있는 맨션은 판에서 빠진 것처럼 저장되지만 맨션은 그대로이므로 맨션 가치를 다시 더함\n      // (안 그러면 킹 귀환을 \"맨션 하나를 잃는 수\"로 잘못 평가함)\n      v += (int(pos.mansion_merged(us)) - int(pos.mansion_merged(~us))) * pos.variant()->pieceValue[MG][pos.production_piece()];\n  }");

// ---- 킹 귀환 보너스(UCI MansionKingBonus) ----
rep("variant.h", "  int productionPointValue = 0;\n", "  int productionPointValue = 0;\n  // 킹이 맨션에 들어가 있을 때의 평가 보너스(출격·맨션 옮기기 능력 값)\n  int mansionKingBonus = 0;\n");
rep("ucioption.cpp", "    v->productionPointValue = int(Options[\"MansionPointValue\"]);\n", "    v->productionPointValue = int(Options[\"MansionPointValue\"]);\n    v->mansionKingBonus = int(Options[\"MansionKingBonus\"]);\n");
rep("ucioption.cpp", "  o[\"MansionPointValue\"]     << Option(60, 0, 2000, on_mansion_value);\n", "  o[\"MansionPointValue\"]     << Option(60, 0, 2000, on_mansion_value);\n  o[\"MansionKingBonus\"]      << Option(175, -2000, 2000, on_mansion_value);\n");
rep("evaluate.cpp", "      v += (int(pos.mansion_merged(us)) - int(pos.mansion_merged(~us))) * pos.variant()->pieceValue[MG][pos.production_piece()];\n", "      v += (int(pos.mansion_merged(us)) - int(pos.mansion_merged(~us))) * (pos.variant()->pieceValue[MG][pos.production_piece()] + pos.variant()->mansionKingBonus);\n");

// ---- 체스맨션 전용 평가 항목·기물 가치 %(UCI 옵션, SPSA 튜닝용) ----
rep("variant.h", "  int mansionKingBonus = 0;\n", "  int mansionKingBonus = 0;\n  // 체스맨션 전용 평가 항목(전부 SPSA 튜닝 대상, 기본 0)\n  int mansionSquareValue = 0;   // 출격할 수 있는 빈칸 1칸당\n  int mansionAliveBonus = 0;    // 맨션이 하나라도 남아 있으면(마지막 맨션의 추가 가치)\n  int mansionShelterBonus = 0;  // 킹이 내 맨션 바로 옆에 있으면(한 수 만에 귀환 가능)\n  int mansionReady3 = 0;        // 영향력 3P 이상(나이트·비숍 출격 가능)\n  int mansionReady9 = 0;        // 영향력 9P 이상(퀸 출격 가능)\n");
rep("ucioption.cpp", "    v->mansionKingBonus = int(Options[\"MansionKingBonus\"]);\n", "    v->mansionKingBonus = int(Options[\"MansionKingBonus\"]);\n    v->mansionSquareValue = int(Options[\"MansionSquareValue\"]);\n    v->mansionAliveBonus = int(Options[\"MansionAliveBonus\"]);\n    v->mansionShelterBonus = int(Options[\"MansionShelterBonus\"]);\n    v->mansionReady3 = int(Options[\"MansionReady3\"]);\n    v->mansionReady9 = int(Options[\"MansionReady9\"]);\n    // 기물 가치: 표준 체스 값의 %(100 = 그대로)\n    const char* pctNames[] = {\"MansionPawnPct\", \"MansionKnightPct\", \"MansionBishopPct\", \"MansionRookPct\", \"MansionQueenPct\"};\n    PieceType pts[] = {PAWN, KNIGHT, BISHOP, ROOK, QUEEN};\n    for (int i = 0; i < 5; ++i)\n        for (Phase ph : {MG, EG})\n            v->pieceValue[ph][pts[i]] = Value(int(PieceValue[ph][pts[i]]) * int(Options[pctNames[i]]) / 100);\n");
rep("ucioption.cpp", "  o[\"MansionKingBonus\"]      << Option(175, -2000, 2000, on_mansion_value);\n", "  o[\"MansionKingBonus\"]      << Option(175, -2000, 2000, on_mansion_value);\n  o[\"MansionSquareValue\"]    << Option(32, -500, 500, on_mansion_value);\n  o[\"MansionAliveBonus\"]     << Option(210, -3000, 3000, on_mansion_value);\n  o[\"MansionShelterBonus\"]   << Option(-8, -1000, 1000, on_mansion_value);\n  o[\"MansionReady3\"]         << Option(32, -1000, 1000, on_mansion_value);\n  o[\"MansionReady9\"]         << Option(49, -1000, 1000, on_mansion_value);\n  o[\"MansionPawnPct\"]        << Option(106, 30, 300, on_mansion_value);\n  o[\"MansionKnightPct\"]      << Option(105, 30, 300, on_mansion_value);\n  o[\"MansionBishopPct\"]      << Option(99, 30, 300, on_mansion_value);\n  o[\"MansionRookPct\"]        << Option(89, 30, 300, on_mansion_value);\n  o[\"MansionQueenPct\"]       << Option(66, 30, 300, on_mansion_value);\n");
rep("evaluate.cpp", "      v += (int(pos.mansion_merged(us)) - int(pos.mansion_merged(~us))) * (pos.variant()->pieceValue[MG][pos.production_piece()] + pos.variant()->mansionKingBonus);\n", "      v += (int(pos.mansion_merged(us)) - int(pos.mansion_merged(~us))) * (pos.variant()->pieceValue[MG][pos.production_piece()] + pos.variant()->mansionKingBonus);\n      // 체스맨션 전용 평가 항목 — 출격 빈칸·마지막 맨션·킹의 피신 거리·영향력 문턱\n      const Variant* mv = pos.variant();\n      auto mansionTerms = [&](Color c) {\n          int s = 0;\n          bool merged = pos.mansion_merged(c);\n          Bitboard mansions = pos.pieces(c, pos.production_piece());\n          if (!mansions && !merged)\n              return 0;\n          s += mv->mansionAliveBonus;\n          s += popcount(pos.production_squares(c) & ~pos.pieces()) * mv->mansionSquareValue;\n          if (!merged && pos.count<KING>(c) && (PseudoAttacks[WHITE][KING][pos.square<KING>(c)] & mansions))\n              s += mv->mansionShelterBonus;\n          int p = pos.production_points(c);\n          if (p >= 3) s += mv->mansionReady3;\n          if (p >= 9) s += mv->mansionReady9;\n          return s;\n      };\n      v += mansionTerms(us) - mansionTerms(~us);\n");

// ---- SPSA 튜닝값을 엔진 기본값으로(2026-10-04) — 영향력 1P 가치 60 → 118 ----
rep('ucioption.cpp', '  o["MansionPointValue"]     << Option(60, 0, 2000, on_mansion_value);\n', '  o["MansionPointValue"]     << Option(118, 0, 2000, on_mansion_value);\n');
// ---- 2026-10-04 영향력 개편: 매 수 +1 없음, 상대 기물을 잡으면 그 기물 출격 비용만큼(맨션 0), 귀환은 출격 비용만큼 ----
rep('position.cpp', '      else if (has_mansion(us))\n          st->productionPoints[us] = std::min(st->productionPoints[us] + 1, var->productionPointCap);\n',
    '      else if (captured && color_of(captured) == them && has_mansion(us))\n          st->productionPoints[us] = std::min(st->productionPoints[us] + production_cost(type_of(captured)), var->productionPointCap);\n');
rep('position.cpp', '          st->productionPoints[us] += 1;\n', '');

rep('position.cpp', '          st->productionPoints[us] += production_cost(type_of(pc)) + 1;\n', '          st->productionPoints[us] += production_cost(type_of(pc));\n');

// ---- 룩4+나이트7 배치 SPSA 튜닝값(2026-10-04, 30분·726판)을 엔진 기본값으로 ----
{
    const tuned = { MansionValue: 1369, MansionPointValue: 66, MansionKingBonus: 211, MansionSquareValue: 37, MansionAliveBonus: 201, MansionShelterBonus: -9, MansionReady3: 31, MansionReady9: 16, MansionPawnPct: 98, MansionKnightPct: 102, MansionBishopPct: 94, MansionRookPct: 93, MansionQueenPct: 59 };
    const p = path.join(src, 'ucioption.cpp');
    let s = fs.readFileSync(p, 'utf8');
    for (const [name, value] of Object.entries(tuned)) {
        const re = new RegExp('(o\\["' + name + '"\\]\\s*<< Option\\()-?\\d+');
        if (!re.test(s)) throw new Error('option not found: ' + name);
        s = s.replace(re, '$1' + value);
    }
    fs.writeFileSync(p, s);
}

console.log('chessmansion 7x7 patch applied');
