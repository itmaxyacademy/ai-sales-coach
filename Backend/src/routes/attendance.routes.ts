import { Router } from "express";
import { checkIn, checkOut, getTodayAttendance } from "../controllers/attendanceController.js";

export const attendanceRouter = Router();
attendanceRouter.get("/today", getTodayAttendance);
attendanceRouter.post("/check-in", checkIn);
attendanceRouter.post("/check-out", checkOut);
