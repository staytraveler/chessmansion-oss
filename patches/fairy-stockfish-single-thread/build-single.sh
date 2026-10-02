#!/usr/bin/env bash
# 체스맨션용 Fairy-Stockfish 싱글스레드 wasm 빌드
# - 스레드/SharedArrayBuffer 없이 동작 → COOP/COEP 격리 없이, 아이폰(WebKit) 포함 모든 브라우저에서 실행
# - Web Worker로 직접 띄우는 형태(worker-single.js)
# - largeboards/allvars 끔(가드너 5x5는 기본 변형), NNUE 내장 안 함(현재 쓰던 npm 빌드와 동일하게 고전 평가)
# - wasm SIMD 끔(구형 iOS 호환)
set -euo pipefail
cd "$(dirname "$0")/fairy-stockfish.wasm/src"

SRCS="benchmark.cpp bitbase.cpp bitboard.cpp endgame.cpp evaluate.cpp main.cpp \
material.cpp misc.cpp movegen.cpp movepick.cpp pawns.cpp position.cpp psqt.cpp \
search.cpp thread.cpp timeman.cpp tt.cpp uci.cpp ucioption.cpp tune.cpp syzygy/tbprobe.cpp \
nnue/evaluate_nnue.cpp nnue/features/half_ka_v2.cpp \
partner.cpp parser.cpp piece.cpp variant.cpp xboard.cpp \
nnue/features/half_ka_v2_variants.cpp"

COMMIT=$(git rev-parse --short HEAD)
OUT=../../out
mkdir -p "$OUT"

em++ -std=c++17 -O3 -DNDEBUG -fno-exceptions -fno-strict-aliasing -Wno-everything \
  -DIS_64BIT -DUSE_POPCNT -DUSE_PTHREADS -DNNUE_EMBEDDING_OFF -DSINGLE_THREADED \
  -DEM_COMMIT="$COMMIT" -DEM_UPSTREAM="$COMMIT" -DEM_EMSCRIPTEN=2.0.26-single \
  $SRCS \
  --pre-js emscripten/preamble-single.js \
  --extern-post-js emscripten/worker-single.js \
  -s MODULARIZE=1 -s EXPORT_NAME=Stockfish -s ENVIRONMENT=web,worker \
  -s ASYNCIFY=1 -s 'ASYNCIFY_IMPORTS=["emscripten_utils_getline_impl"]' \
  -s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=67108864 -s MAXIMUM_MEMORY=1073741824 \
  -s ALLOW_UNIMPLEMENTED_SYSCALLS -s ASSERTIONS=0 \
  --closure 0 \
  -o "$OUT/stockfish.js"

ls -la "$OUT"
