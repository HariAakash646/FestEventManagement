import express from 'express'
import dotenv from "dotenv"
import cors from "cors"
import { connectDB } from './config/db.js';

import eventRoutes from "./routes/event.route.js"
import userRoutes from "./routes/user.route.js"
import tagRoutes from "./routes/tag.route.js"
import passwordResetRequestRoutes from "./routes/passwordResetRequest.route.js"
import itemRoutes from "./routes/item.route.js"

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "15mb" })); // Allows accepting larger json payloads (e.g., payment proof base64)
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

app.use("/api/events", eventRoutes)
app.use("/api/users", userRoutes)
app.use("/api/tags", tagRoutes)
app.use("/api/password-reset-requests", passwordResetRequestRoutes)
app.use("/api/items", itemRoutes)

app.listen(PORT, () => {
    connectDB();
    console.log("Server started at http://localhost:" + PORT);
})
