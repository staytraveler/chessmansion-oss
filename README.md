# ChessMansion — Open Source Components

체스맨션(ChessMansion) 앱이 사용하는 오픈소스 체스 엔진과 그 소스 코드를 공개하는 저장소입니다.
This repository publishes the open-source chess engines used by the ChessMansion app, together with their complete source code, as required by the GNU General Public License v3.

- 앱 웹사이트: https://chessmansion.com
- 라이선스: [GNU GPL v3](./LICENSE) (엔진 원저작권은 각 프로젝트의 저작자에게 있습니다 — [engines/fairy-stockfish/AUTHORS](./engines/fairy-stockfish/AUTHORS) 및 각 소스 압축본의 AUTHORS 참고)

## 사용하는 엔진 / Engines

| 엔진 | 앱에서의 용도 | 배포 버전 | 소스 (정확한 빌드 커밋) |
|---|---|---|---|
| **Stockfish** (stockfish.js, `stockfish-19-lite-single`) | 클래식 체스·안개 체스·체스의 신 AI | npm [`stockfish`](https://www.npmjs.com/package/stockfish) **19.0.0** | [nmrugg/stockfish.js @ `54fde71`](https://github.com/nmrugg/stockfish.js/tree/54fde71d90c7c403964f6cacef48f7bbec495df1) |
| **Fairy-Stockfish** (WebAssembly 빌드) | 5×5 체스 AI (`gardner` 변형) | npm [`fairy-stockfish-nnue.wasm`](https://www.npmjs.com/package/fairy-stockfish-nnue.wasm) **1.1.12** | [fairy-stockfish/fairy-stockfish.wasm @ `b2e693e`](https://github.com/fairy-stockfish/fairy-stockfish.wasm/tree/b2e693ef1e111233ce3fb40685921708b3276ed6) |

원본 프로젝트 / Upstream projects:
- Stockfish — https://github.com/official-stockfish/Stockfish
- Fairy-Stockfish — https://github.com/fairy-stockfish/Fairy-Stockfish

## 이 저장소의 내용 / Contents

```
engines/stockfish/         앱이 실제로 배포하는 Stockfish 파일 (npm stockfish 19.0.0 그대로, 수정 없음)
engines/fairy-stockfish/   앱이 실제로 배포하는 Fairy-Stockfish 파일 (npm fairy-stockfish-nnue.wasm 1.1.12 그대로, 수정 없음)
source/                    위 파일들을 빌드한 커밋의 전체 소스 코드 압축본 (C++ 소스 + 빌드 스크립트)
SHA256SUMS.txt             위 파일들의 체크섬
LICENSE                    GNU General Public License v3 전문
```

엔진 파일은 **수정하지 않은 원본 빌드 그대로** 배포합니다. 소스 압축본은 각 npm 패키지의 `gitHead`(빌드에 쓰인 커밋)에서 받은 것으로, 원본 저장소가 사라지더라도 대응 소스를 받을 수 있도록 함께 보관합니다.
The engine files are distributed unmodified. The source archives were taken from the exact commits (`gitHead`) the npm packages were built from, and are mirrored here so the corresponding source remains available.

## 앱에서 엔진을 쓰는 방식 / How the app uses the engines

- 엔진은 브라우저 안에서 **별도의 Web Worker(또는 엔진 자체의 WebAssembly 스레드)**로 실행되고, 앱은 표준 **UCI 텍스트 명령**(`position`, `go depth N movetime M`, `bestmove` 등)으로만 엔진과 주고받습니다. 엔진 코드와 앱 코드는 서로 링크되지 않은 별개의 프로그램입니다.
  The engines run as separate programs (a Web Worker / the engine's own WebAssembly threads) and communicate with the app only through the standard UCI text protocol. The engine code is not linked into the app code.
- 난이도는 엔진 옵션이 아니라 탐색 깊이(`go depth`)와 시간 제한(`movetime`)으로만 조절합니다.
- Fairy-Stockfish는 `setoption name UCI_Variant value gardner`로 5×5 변형을 사용합니다.

## 소스에서 직접 빌드하기 / Building from source

각 소스 압축본의 README에 빌드 방법이 있습니다(Emscripten 필요).
See the README inside each source archive for build instructions (requires Emscripten).

## 문의 / Contact

staytraveler@gmail.com
