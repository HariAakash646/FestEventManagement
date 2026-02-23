import nodemailer from "nodemailer";

const normalizeEnvValue = (value) => {
    if (typeof value !== "string") return "";
    return value.trim();
};

const createTransporter = () => {
    const host = normalizeEnvValue(process.env.SMTP_HOST);
    const port = Number(normalizeEnvValue(process.env.SMTP_PORT) || 587);
    const user = normalizeEnvValue(process.env.SMTP_USER);
    const pass = normalizeEnvValue(process.env.SMTP_PASS);
    const secure = normalizeEnvValue(process.env.SMTP_SECURE) === "true";

    if (!host || !user || !pass) {
        return null;
    }

    return nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
            user,
            pass,
        },
    });
};

const formatDateTime = (value) => {
    if (!value) return "Not specified";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not specified";
    return date.toLocaleString();
};

const buildQrAttachment = (qrCodeDataUrl, cid) => {
    if (!qrCodeDataUrl || typeof qrCodeDataUrl !== "string") return null;
    const match = qrCodeDataUrl.match(/^data:image\/png;base64,(.+)$/);
    if (!match) return null;
    return {
        filename: "qr.png",
        content: match[1],
        encoding: "base64",
        cid,
    };
};

export const sendRegistrationTicketEmail = async ({
    recipientEmail,
    userId,
    eventId,
    participantName,
    eventName,
    organizerName,
    registrationDateTime,
    eventStartDateTime,
    eventEndDateTime,
    qrCodeDataUrl,
}) => {
    const transporter = createTransporter();
    if (!transporter) {
        throw new Error("SMTP is not configured");
    }

    const fromEmail = normalizeEnvValue(process.env.SMTP_FROM) || normalizeEnvValue(process.env.SMTP_USER);
    const subject = `Registration Ticket - ${eventName}`;

    const text = [
        "Your event registration is confirmed.",
        "",
        `User ID: ${userId}`,
        `Event ID: ${eventId}`,
        `Participant Name: ${participantName}`,
        `Event Name: ${eventName}`,
        `Organizer Name: ${organizerName}`,
        `Registration Date and Time: ${formatDateTime(registrationDateTime)}`,
        `Event Start Date and Time: ${formatDateTime(eventStartDateTime)}`,
        `Event End Date and Time: ${formatDateTime(eventEndDateTime)}`,
    ].join("\n");

    const qrCid = "registration-qr@felicity";
    const qrAttachment = buildQrAttachment(qrCodeDataUrl, qrCid);

    const html = `
        <p>Your event registration is confirmed.</p>
        <p><strong>User ID:</strong> ${userId}</p>
        <p><strong>Event ID:</strong> ${eventId}</p>
        <p><strong>Participant Name:</strong> ${participantName}</p>
        <p><strong>Event Name:</strong> ${eventName}</p>
        <p><strong>Organizer Name:</strong> ${organizerName}</p>
        <p><strong>Registration Date and Time:</strong> ${formatDateTime(registrationDateTime)}</p>
        <p><strong>Event Start Date and Time:</strong> ${formatDateTime(eventStartDateTime)}</p>
        <p><strong>Event End Date and Time:</strong> ${formatDateTime(eventEndDateTime)}</p>
        ${qrAttachment ? `<p><strong>QR Code:</strong></p><img src="cid:${qrCid}" alt="Registration QR" />` : ""}
    `;

    await transporter.verify();

    await transporter.sendMail({
        from: fromEmail,
        to: recipientEmail,
        subject,
        text,
        html,
        ...(qrAttachment ? { attachments: [qrAttachment] } : {}),
    });
};

export const sendOrganizerPasswordResetEmail = async ({
    recipientEmail,
    organizerName,
    organizerId,
    temporaryPassword,
    requestDate,
}) => {
    const transporter = createTransporter();
    if (!transporter) {
        throw new Error("SMTP is not configured");
    }

    const fromEmail = normalizeEnvValue(process.env.SMTP_FROM) || normalizeEnvValue(process.env.SMTP_USER);
    const subject = "Password Reset Approved";

    const text = [
        `Hello ${organizerName},`,
        "",
        "Your password reset request has been approved.",
        `Organizer ID: ${organizerId}`,
        `Request Date: ${formatDateTime(requestDate)}`,
        `New Password: ${temporaryPassword}`,
        "",
        "Please log in and change your password immediately.",
    ].join("\n");

    await transporter.verify();

    await transporter.sendMail({
        from: fromEmail,
        to: recipientEmail,
        subject,
        text,
    });
};

export const sendMerchPurchaseEmail = async ({
    recipientEmail,
    participantName,
    eventName,
    itemName,
    quantity,
    costPerItem,
    totalCost,
    purchasedAt,
    qrCodeDataUrl,
}) => {
    const transporter = createTransporter();
    if (!transporter) {
        throw new Error("SMTP is not configured");
    }

    const fromEmail = normalizeEnvValue(process.env.SMTP_FROM) || normalizeEnvValue(process.env.SMTP_USER);
    const subject = `Purchase Confirmation - ${eventName}`;

    const text = [
        "Your merchandise purchase is confirmed.",
        "",
        `Participant Name: ${participantName}`,
        `Event Name: ${eventName}`,
        `Item Name: ${itemName}`,
        `Quantity: ${quantity}`,
        `Cost per Item: ${costPerItem}`,
        `Total Cost: ${totalCost}`,
        `Purchase Date and Time: ${formatDateTime(purchasedAt)}`,
    ].join("\n");

    const qrCid = "purchase-qr@felicity";
    const qrAttachment = buildQrAttachment(qrCodeDataUrl, qrCid);

    const html = `
        <p>Your merchandise purchase is confirmed.</p>
        <p><strong>Participant Name:</strong> ${participantName}</p>
        <p><strong>Event Name:</strong> ${eventName}</p>
        <p><strong>Item Name:</strong> ${itemName}</p>
        <p><strong>Quantity:</strong> ${quantity}</p>
        <p><strong>Cost per Item:</strong> ${costPerItem}</p>
        <p><strong>Total Cost:</strong> ${totalCost}</p>
        <p><strong>Purchase Date and Time:</strong> ${formatDateTime(purchasedAt)}</p>
        ${qrAttachment ? `<p><strong>QR Code:</strong></p><img src="cid:${qrCid}" alt="Purchase QR" />` : ""}
    `;

    await transporter.verify();

    await transporter.sendMail({
        from: fromEmail,
        to: recipientEmail,
        subject,
        text,
        html,
        ...(qrAttachment ? { attachments: [qrAttachment] } : {}),
    });
};
