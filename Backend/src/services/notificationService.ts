/**
 * notificationService.ts
 * In-app notification system.
 *
 * Trigger events:
 *   - Assignment baru masuk → notif ke karyawan
 *   - Due date < 3 hari     → notif ke karyawan
 *   - Karyawan selesai sesi → notif ke manager
 *   - Naik ranking (≥3 pos) → notif ke karyawan
 */
import { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
    },
  });
}

export async function getUserNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function markAsRead(
  notificationId: string,
  userId: string
): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}

export async function markAllAsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
}

// ─── EVENT HELPERS ────────────────────────────────────

export async function notifyNewAssignment(
  userId: string,
  courseTitle: string,
  assignmentId: string,
  dueAt?: Date | null
): Promise<void> {
  const dueStr = dueAt ? `, due ${dueAt.toLocaleDateString('id-ID')}` : '';
  await createNotification(
    userId,
    NotificationType.new_assignment,
    'Assignment Baru',
    `Kamu mendapat assignment: "${courseTitle}"${dueStr}. Mulai sekarang!`,
    { assignmentId, courseTitle }
  );
}

export async function notifyDueDateReminder(
  userId: string,
  courseTitle: string,
  assignmentId: string,
  dueAt: Date
): Promise<void> {
  const diffDays = Math.ceil((dueAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  await createNotification(
    userId,
    NotificationType.due_date_reminder,
    '⏰ Deadline Mendekat',
    `Assignment "${courseTitle}" due dalam ${diffDays} hari. Jangan sampai terlewat!`,
    { assignmentId, courseTitle, dueAt: dueAt.toISOString() }
  );
}

export async function notifySessionCompleted(
  managerId: string,
  karyawanName: string,
  courseTitle: string,
  score: number,
  outcome: string,
  sessionId: string
): Promise<void> {
  await createNotification(
    managerId,
    NotificationType.session_completed,
    '✅ Sesi Selesai',
    `${karyawanName} menyelesaikan "${courseTitle}" dengan skor ${score} (${outcome}).`,
    { sessionId, karyawanName, courseTitle, score, outcome }
  );
}

export async function notifyRankUp(
  userId: string,
  oldRank: number,
  newRank: number
): Promise<void> {
  const up = oldRank - newRank;
  await createNotification(
    userId,
    NotificationType.rank_up,
    '🏆 Ranking Naik!',
    `Selamat! Kamu naik ${up} posisi ke rank #${newRank} di leaderboard bulan ini.`,
    { oldRank, newRank, improvement: up }
  );
}

export async function broadcastNotification(
  userIds: string[],
  title: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await prisma.notification.createMany({
    data: userIds.map(userId => ({
      userId,
      type: NotificationType.broadcast,
      title,
      message,
      metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
    })),
  });
}
