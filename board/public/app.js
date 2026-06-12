// board/public/app.js — progressive enhancement: live refresh via SSE.
// The board is fully usable without this file (HTML forms POST natively).
(function () {
  if (!('EventSource' in window)) return
  var es = new EventSource('/events')
  var firstReady = false
  es.onmessage = function (e) {
    if (e.data === 'connected') { firstReady = true; return }
    if (e.data === 'reload' && firstReady) {
      // debounce bursts of file events into a single reload
      clearTimeout(window.__reloadT)
      window.__reloadT = setTimeout(function () { location.reload() }, 200)
    }
  }
})()
