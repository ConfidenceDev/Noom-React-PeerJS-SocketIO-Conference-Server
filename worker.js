import { parentPort } from "worker_threads"

let duration = 7200 // 2hrs

const timerInterval = setInterval(() => {
  if (duration <= 0) {
    clearInterval(timerInterval)
    parentPort.postMessage(duration)
  } else {
    parentPort.postMessage(duration--)
  }
}, 1000)
