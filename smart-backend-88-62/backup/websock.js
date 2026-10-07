// const express = require("express");
// const WebSocket = require("ws");
// const cors = require("cors");

// const app = express();
// const PORT = 5000;
// app.use(cors());

// // Express route
// app.get("/", (req, res) => {
//   res.send("WebSocket Server Running");
// });

// // WebSocket server
// const server = app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });

// const wss = new WebSocket.Server({ server, path: "/ws/data" });

// wss.on("connection", (ws) => {
//   console.log("WebSocket client connected");

//   // Forward messages received to all clients
//   //   ws.on("message", (data) => {
//   //     const message = data.toString(); // แปลง Buffer เป็น String
//   //     console.log("Received from Node-RED:", message);
//   //     ws.send(`Echo: ${message}`);
//   //   });

//   ws.on("message", (message) => {
//     console.log("Received message:", message.toString());

//     // Broadcast the message to all connected clients
//     wss.clients.forEach((client) => {
//       if (client.readyState === WebSocket.OPEN) {
//         client.send(message.toString());
//       }
//     });
//   });

//   ws.send("Hello from Express WebSocket Server");
// });
