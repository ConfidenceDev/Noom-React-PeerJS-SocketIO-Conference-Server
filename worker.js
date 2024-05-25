import { parentPort } from "worker_threads"

parentPort.on("message", (duration) => {
  const timerInterval = setInterval(() => {
    if (duration <= 0) {
      clearInterval(timerInterval)
      parentPort.postMessage(duration)
    } else {
      parentPort.postMessage(duration--)
    }
  }, 1000)
})
