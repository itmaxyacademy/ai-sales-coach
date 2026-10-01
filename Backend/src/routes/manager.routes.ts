import { Router } from "express";
import {
  getManagerDashboard,
  getTeamList,
  getTeamAssignments,
  getTeamMemberDetail,
  getTeamMemberSessions,
  getTeamMemberAssignments,
  getSessionDetail,
  getAnalyticsOverview,
  getAnalyticsCourses,
  getAnalyticsTrends,
  getAnalyticsWeaknesses,
  exportTeamList,
  getAllTeamSessions
} from "../controllers/managerController.js";
import {
  getManagerLeaderboard,
  getLeaderboardConfigHandler,
  updateLeaderboardConfigHandler
} from "../controllers/leaderboardController.js";

export const managerRouter = Router();

// Middleware auth check - Team Leader, Company Admin, atau Super Admin bisa akses
managerRouter.use((req, res, next) => {
  const allowedRoles = ["manager", "company_admin", "super_admin"];
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: { message: "Akses team leader / company admin diperlukan." } });
  }
  next();
});

// Dashboard & Team
managerRouter.get("/dashboard", getManagerDashboard);
managerRouter.get("/team/export", exportTeamList);
managerRouter.get("/team", getTeamList);
managerRouter.get("/assignments", getTeamAssignments);
managerRouter.get("/team/:userId", getTeamMemberDetail);
managerRouter.get("/team/:userId/sessions", getTeamMemberSessions);
managerRouter.get("/team/:userId/assignments", getTeamMemberAssignments);

// Sessions
managerRouter.get("/sessions", getAllTeamSessions);
managerRouter.get("/sessions/:sessionId", getSessionDetail);

// Analytics
managerRouter.get("/analytics/overview", getAnalyticsOverview);
managerRouter.get("/analytics/leaderboard", getManagerLeaderboard);
managerRouter.get("/analytics/courses", getAnalyticsCourses);
managerRouter.get("/analytics/trends", getAnalyticsTrends);
managerRouter.get("/analytics/weaknesses", getAnalyticsWeaknesses);

// Leaderboard Config
managerRouter.get("/leaderboard/config", getLeaderboardConfigHandler);
managerRouter.patch("/leaderboard/config", updateLeaderboardConfigHandler);
