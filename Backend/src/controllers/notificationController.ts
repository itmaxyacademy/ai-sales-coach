import type { RequestHandler } from "express";
import { HttpError } from "../lib/http-error.js";
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
} from "../services/notificationService.js";

// GET /api/notifications
export const getNotifications: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, "Login diperlukan.");
    const userId = req.user.sub;
    const notifications = await getUserNotifications(userId);
    res.json({ data: notifications });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/notifications/:id/read
export const readNotification: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, "Login diperlukan.");
    const userId = req.user.sub;
    const id = req.params.id as string;
    await markAsRead(id, userId);
    res.json({ message: "Notifikasi ditandai sebagai dibaca." });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/notifications/read-all
export const readAllNotifications: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, "Login diperlukan.");
    const userId = req.user.sub;
    await markAllAsRead(userId);
    res.json({ message: "Semua notifikasi ditandai sebagai dibaca." });
  } catch (error) {
    next(error);
  }
};

// GET /api/notifications/unread-count
export const getNotificationsUnreadCount: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    if (!req.user) throw new HttpError(401, "Login diperlukan.");
    const userId = req.user.sub;
    try {
      const count = await getUnreadCount(userId);
      res.json({ count });
    } catch {
      res.json({ count: 0 });
    }
  } catch (error) {
    next(error);
  }
};
