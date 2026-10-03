# ChessMansion — Open Source Components

체스맨션(ChessMansion) 앱이 사용하는 오픈소스 체스 엔진과 그 소스 코드를 공개하는 저장소입니다.
This repository publishes the open-source chess engines used by the ChessMansion app, together with their complete source code, as required by the GNU General Public License v3.

- 앱 웹사이트: https://chessmansion.com
- 라이선스: [GNU GPL v3](./LICENSE) (엔진 원저작권은 각 프로젝트의 저작자에게 있습니다 — [engines/fairy-stockfish/AUTHORS](./engines/fairy-stockfish/AUTHORS) 및 각 소스 압축본의 AUTHORS 참고)

## 사용하는 엔진 / Engines

| 엔진 | 앱에서의 용도 | 배포 버전 | 소스 (정확한 빌드 커밋) |
|---|---|---|---|
| **Stockfish** (stockfish.js, `stockfish-19-lite-single`) | 클래식 체스·안개 체스·체스의 신 AI | npm [`stockfish`](https://www.npmjs.com/package/stockfish) **19.0.0** | [nmrugg/stockfish.js @ `54fde71`](https://github.com/nmrugg/stockfish.js/tree/54fde71d90c7c403964f6cacef48f7bbec495df1) |
| **Fairy-Stockfish** (WebAssembly **싱글스레드** 빌드, 체스맨션 수정본) | 체스맨션 AI·기보 분석 (`chessmansion` 변형, 직접 추가), 5×5 체스 AI (`gardner` 변형) | 직접 빌드 (Emscripten 2.0.26) | [fairy-stockfish/fairy-stockfish.wasm @ `4d4b393`](https://github.com/fairy-stockfish/fairy-stockfish.wasm/tree/4d4b39395955df4695f28887800f0836f9c4d37d) + [patches/fairy-stockfish-single-thread](./patches/fairy-stockfish-single-thread) + [patches/fairy-stockfish-chessmansion](./patches/fairy-stockfish-chessmansion) |

원본 프로젝트 / Upstream projects:
- Stockfish — https://github.com/official-stockfish/Stockfish
- Fairy-Stockfish — https://github.com/fairy-stockfish/Fairy-Stockfish

## 이 저장소의 내용 / Contents

```
engines/stockfish/         앱이 실제로 배포하는 Stockfish 파일 (npm stockfish 19.0.0 그대로, 수정 없음)
engines/fairy-stockfish/   앱이 실제로 배포하는 Fairy-Stockfish 파일 (싱글스레드로 직접 빌드한 수정본 — 아래 참고)
patches/                   Fairy-Stockfish 수정 내용(소스 패치)과 빌드 스크립트
source/                    위 파일들을 빌드한 커밋의 전체 소스 코드 압축본 (C++ 소스 + 빌드 스크립트)
SHA256SUMS.txt             위 파일들의 체크섬
LICENSE                    GNU General Public License v3 전문
```

Stockfish는 **수정하지 않은 원본 빌드 그대로** 배포합니다. Fairy-Stockfish는 아이폰(WebKit) 등 SharedArrayBuffer를 쓸 수 없는 브라우저에서도 돌도록 **스레드 없이 동작하게 수정해서 직접 빌드**했습니다(아래 "Fairy-Stockfish 수정 사항"). 소스 압축본은 각 npm 패키지의 `gitHead`(빌드에 쓰인 커밋)에서 받은 것으로, 원본 저장소가 사라지더라도 대응 소스를 받을 수 있도록 함께 보관합니다.
Stockfish is distributed unmodified. Fairy-Stockfish is a modified single-threaded build (see "Fairy-Stockfish modifications" below). The source archives were taken from the exact commits (`gitHead`) the npm packages were built from, and are mirrored here so the corresponding source remains available.

## 앱에서 엔진을 쓰는 방식 / How the app uses the engines

- 엔진은 브라우저 안에서 **별도의 Web Worker(또는 엔진 자체의 WebAssembly 스레드)**로 실행되고, 앱은 표준 **UCI 텍스트 명령**(`position`, `go depth N movetime M`, `bestmove` 등)으로만 엔진과 주고받습니다. 엔진 코드와 앱 코드는 서로 링크되지 않은 별개의 프로그램입니다.
  The engines run as separate programs (a Web Worker / the engine's own WebAssembly threads) and communicate with the app only through the standard UCI text protocol. The engine code is not linked into the app code.
- 난이도는 탐색 깊이(`go depth`)·시간 제한(`movetime`)과, 체스맨션 AI에서는 엔진의 표준 옵션 `Skill Level`로 조절합니다.
- Fairy-Stockfish는 `setoption name UCI_Variant value chessmansion`(체스맨션) / `gardner`(5×5)로 변형을 고릅니다.

## Fairy-Stockfish 수정 사항 / Fairy-Stockfish modifications

2026-10-02 — 기반 소스: `fairy-stockfish/fairy-stockfish.wasm` 커밋 `4d4b39395955df4695f28887800f0836f9c4d37d` (소스 압축본: `source/fairy-stockfish.wasm-4d4b39395955df4695f28887800f0836f9c4d37d.tar.gz`)

`patches/fairy-stockfish-single-thread/`:

- `single-thread.patch` — `src/thread.cpp`, `src/thread.h`: `SINGLE_THREADED` 매크로가 정의되면 탐색 스레드를 따로 만들지 않고 호출한 쪽에서 바로 탐색함(멀티스레드·SharedArrayBuffer 불필요).
- `preamble-single.js` — 원본 `src/emscripten/preamble.js`에서 pthread 의존을 뺀 UCI 명령 큐/출력 연결.
- `worker-single.js` — 빌드 결과를 `new Worker('stockfish.js')`로 바로 띄울 수 있게 하는 진입 코드.
- `build-single.sh` — 실제 빌드 명령(Emscripten 2.0.26, `-DSINGLE_THREADED`, largeboards·allvars·NNUE 내장·wasm SIMD 끔).

`patches/fairy-stockfish-chessmansion/` (2026-10-02, 마지막 수정 2026-10-03):

- `chessmansion.patch` — 현재 배포 빌드에 들어간 체스맨션 변형 수정 전체(스레드 관련 파일 제외, `git diff` 결과). `src/variant.cpp/.h`(6×6 `chessmansion` 변형, 맨션 기물 `m` = Betza "AD", 캐슬링은 맨션 쪽·룩 쪽 둘 다, 무진전 무승부 20수), `src/position.cpp/.h`(생산 포인트 상태·해시·FEN 끝 "백포인트 흑포인트", 맨션 옆 칸에만 놓는 생산 착수, 맨션이 잡히면 포인트 0), `src/evaluate.cpp`(포인트 가치), `src/ucioption.cpp`(`MansionValue`, `MansionPointValue` 옵션).
- `patch-mansion.cjs`, `patch-mansion-points.cjs` — 위 수정을 원본 소스에 적용하는 스크립트(이 순서로 실행). 결과는 `chessmansion.patch`와 같음.

빌드 재현: 위 커밋을 받아 `git apply single-thread.patch` → `preamble-single.js`, `worker-single.js`를 `src/emscripten/`에 복사 → `git apply chessmansion.patch`(또는 `node patch-mansion.cjs && node patch-mansion-points.cjs`) → `build-single.sh` 실행.

The Fairy-Stockfish build shipped with the app is modified to run without threads (no SharedArrayBuffer), so it also works in WebKit browsers such as iOS Safari. To reproduce it: check out the commit above, `git apply single-thread.patch`, copy `preamble-single.js` and `worker-single.js` into `src/emscripten/`, then apply `chessmansion.patch` (adds the `chessmansion` variant), and run `build-single.sh`.

## 소스에서 직접 빌드하기 / Building from source

각 소스 압축본의 README에 빌드 방법이 있습니다(Emscripten 필요).
See the README inside each source archive for build instructions (requires Emscripten).

## 문의 / Contact

staytraveler@gmail.com
