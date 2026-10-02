// 체스맨션 싱글스레드 빌드용 preamble(원본 preamble.js에서 PThread 의존을 뺀 버전).
// UCI 명령은 큐에 넣고, 엔진의 메인 루프(emscripten_utils_getline)가 ASYNCIFY로 기다렸다가 꺼내 씀.

class Queue {
  constructor() {
    this.getter = null;
    this.list = [];
  }
  async get() {
    if (this.list.length > 0) {
      return this.list.shift();
    }
    return await new Promise((resolve) => (this.getter = resolve));
  }
  put(x) {
    if (this.getter) {
      this.getter(x);
      this.getter = null;
      return;
    }
    this.list.push(x);
  }
}

Module["queue"] = new Queue();

Module["postMessage"] = (data) => {
  Module["queue"].put(data);
};

const listeners = [];

Module["addMessageListener"] = (listener) => {
  listeners.push(listener);
};

Module["removeMessageListener"] = (listener) => {
  const i = listeners.indexOf(listener);
  if (i >= 0) {
    listeners.splice(i, 1);
  }
};

Module["print"] = Module["printErr"] = (data) => {
  if (listeners.length === 0) {
    console.log(data);
    return;
  }
  for (let listener of listeners) {
    listener(data);
  }
};

Module["terminate"] = () => {};
