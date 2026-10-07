// websocket.js
const WebSocket = require("ws");

let wss = null;

const initWebSocket = (server) => {
  wss = new WebSocket.Server({
    server,
    path: "/ws", // 🔥 สำคัญมาก
  });

  wss.on("connection", (ws, req) => {
    console.log("WebSocket connected:", req.url);

    ws.on("close", () => {
      console.log("WebSocket disconnected");
    });
  });
};

const broadcast = (data) => {
  if (!wss) return;

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

module.exports = {
  initWebSocket,
  broadcast,
};
