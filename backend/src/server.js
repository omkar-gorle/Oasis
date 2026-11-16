import "dotenv/config";
import { app } from "./app.js";
import http from "http";
import { connectDB } from "./db/connection.js";
connectDB()
	.then(() => {
		const server = http.createServer(app);
		server.listen(process.env.PORT || 3000, () => {
			console.log("Server Started at : ", server.address().port);
		});
	})
	.catch((error) => {
		console.log("Error : ", error);
	});
