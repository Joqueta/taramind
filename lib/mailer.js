import nodemailer from "nodemailer";

let transporter;

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT ?? 587),
            secure: Number(process.env.SMTP_PORT) === 465,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }
    return transporter;
}

/**
 * Envoie un email via le SMTP configuré dans .env.
 * @param {{subject: string, html: string}} params
 */
export async function envoyerEmail({ subject, html }) {
    const to = process.env.DIGEST_TO;
    if (!to) {
        throw new Error("DIGEST_TO n'est pas configuré dans .env");
    }

    await getTransporter().sendMail({
        from: process.env.SMTP_USER,
        to,
        subject,
        html,
    });
}
