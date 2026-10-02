// 체스맨션 싱글스레드 빌드: 이 파일을 `new Worker('stockfish.js')`로 띄우면 스스로 엔진을 만들고,
// 워커 메시지(UCI 명령 문자열)를 엔진에 넘기고 엔진 출력 한 줄씩을 다시 postMessage로 돌려줌
// (클래식 Stockfish lite-single 워커와 같은 사용법). 페이지에서 <script>로 불러오면 아무것도 안 함.
if (typeof WorkerGlobalScope !== "undefined" && typeof self !== "undefined" && self instanceof WorkerGlobalScope) {
  const pending = [];
  let engine = null;
  self.onmessage = (e) => {
    if (engine) engine["postMessage"](e.data);
    else pending.push(e.data);
  };
  Stockfish().then((m) => {
    engine = m;
    m["addMessageListener"]((line) => self.postMessage(line));
    for (const cmd of pending) m["postMessage"](cmd);
    pending.length = 0;
  });
}
