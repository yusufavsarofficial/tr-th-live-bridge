require("dotenv").config();

const { createApp, startServer } = require("./src");

createApp()
  .then((instance) => startServer(instance))
  .catch((err) => {
    console.error("Failed to start Pingle:", err.message);
    process.exitCode = 1;
  });
