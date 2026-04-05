/**
 * Drone dashboard WebSocket reconnection — try known drone URLs when the current
 * connection drops (graceful degradation). Use with a plain HTML dashboard or adapt paths.
 *
 * Example:
 *   const mgr = createDroneReconnectManager({ urls: ['ws://localhost:9001','ws://localhost:9002'], onMessage: console.log });
 *   mgr.connect();
 */
(function (global) {
  "use strict";

  function createDroneReconnectManager(options) {
    var urls = options.urls || ["ws://localhost:9001"];
    var onOpen = options.onOpen || function () {};
    var onMessage = options.onMessage || function () {};
    var onClose = options.onClose || function () {};
    var currentIndex = 0;
    var ws = null;
    var stopped = false;
    var reconnectTimer = null;

    function clearTimer() {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    }

    function fetchFullState() {
      try {
        if (typeof options.fetchState === "function") options.fetchState();
      } catch (e) {
        console.warn("[drone-reconnect] fetchState failed", e);
      }
    }

    function connectToNext() {
      if (stopped) return;
      clearTimer();
      if (currentIndex >= urls.length) {
        currentIndex = 0;
        reconnectTimer = setTimeout(connectToNext, 5000);
        return;
      }
      var url = urls[currentIndex];
      currentIndex++;

      try {
        ws = new WebSocket(url);
      } catch (e) {
        console.warn("[drone-reconnect] WebSocket construct failed", url, e);
        reconnectTimer = setTimeout(connectToNext, 1500);
        return;
      }

      ws.onopen = function () {
        currentIndex = 0;
        onOpen(url);
        fetchFullState();
      };
      ws.onmessage = function (ev) {
        onMessage(ev);
      };
      ws.onerror = function () {
        /* onclose will run */
      };
      ws.onclose = function () {
        onClose();
        reconnectTimer = setTimeout(connectToNext, 2000);
      };
    }

    return {
      connect: function () {
        stopped = false;
        currentIndex = 0;
        connectToNext();
      },
      disconnect: function () {
        stopped = true;
        clearTimer();
        if (ws && ws.readyState === WebSocket.OPEN) ws.close();
        ws = null;
      },
    };
  }

  global.createDroneReconnectManager = createDroneReconnectManager;
})(typeof window !== "undefined" ? window : globalThis);
