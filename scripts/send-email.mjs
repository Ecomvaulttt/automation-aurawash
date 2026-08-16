import nodemailer from "nodemailer";

const required = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "EMAIL_TO",
  "EMAIL_SUBJECT",
  "EMAIL_BODY",
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  throw new Error(`Missing email env vars: ${missing.join(", ")}`);
}

const port = Number(process.env.SMTP_PORT);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure: port === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

await transporter.sendMail({
  from: process.env.SMTP_FROM,
  to: process.env.EMAIL_TO,
  replyTo: process.env.EMAIL_REPLY_TO || process.env.SMTP_FROM,
  subject: process.env.EMAIL_SUBJECT,
  text: process.env.EMAIL_BODY,
});

console.log(`Email sent to ${process.env.EMAIL_TO}`);
