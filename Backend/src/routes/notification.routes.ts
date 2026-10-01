import { Router } from "express";
import {
  getNotifications,
  readNotification,
  readAllNotifications,
  getNotificationsUnreadCount,
} from "../controllers/notificationController.js";

export const notificationRouter = Router();

notificationRouter.get("/", getNotifications);
notificationRouter.get("/unread-count", getNotificationsUnreadCount);
notificationRouter.patch("/read-all", readAllNotifications);
notificationRouter.patch("/:id/read", readNotification);
