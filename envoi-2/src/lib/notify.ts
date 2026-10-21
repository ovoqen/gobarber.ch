import nodemailer from "nodemailer";
import { db } from "./db";
import { sendPush } from "./push";

/** Crée une notification in-app et met un e-mail en file (Outbox). Envoi SMTP si SMTP_HOST est défini, sinon consultable en dev. */
export async function notify(userId: string, title: string, body: string, href?: string, email = true) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, deletedAt: true } });
  if (!user || user.deletedAt) return;
  await db.notification.create({ data: { userId, title, body, href } });
  void sendPush(userId, title, body, href); // appareils mobiles (si FCM est configuré)
  if (email) await sendMail(user.email, title, `${body}${href ? `\n\n${process.env.NEXT_PUBLIC_SITE_URL ?? ""}${href}` : ""}\n\n— GoBarber.ch`);
}

export async function sendMail(to: string, subject: string, body: string) {
  const row = await db.outbox.create({ data: { toEmail: to, subject, body } });
  if (!process.env.SMTP_HOST) return;
  try {
    const t = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587), auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
    await t.sendMail({ from: process.env.MAIL_FROM ?? "GoBarber.ch <no-reply@gobarber.ch>", to, subject, text: body });
    await db.outbox.update({ where: { id: row.id }, data: { sentAt: new Date() } });
  } catch (e) { await db.outbox.update({ where: { id: row.id }, data: { error: String((e as Error).message).slice(0, 300) } }); }
}
