import dotenv from "dotenv";

// Imported for its side effect, before anything that reads process.env at module
// load time. ES module imports are hoisted, so calling dotenv.config() further
// down in server.js ran *after* those modules had already been evaluated.
dotenv.config();

export default process.env;
