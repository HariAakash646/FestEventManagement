const formatDateTime = (value) => {
    if (!value) return "N/A";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "N/A";
    return parsed.toLocaleString();
};

export const sendEventPublishedWebhook = async ({
    webhookUrl,
    organizerName,
    eventName,
    eventDescription,
    eventType,
    eventStartDate,
    eventEndDate,
    registrationDeadline,
}) => {
    const trimmedWebhookUrl = typeof webhookUrl === "string" ? webhookUrl.trim() : "";
    if (!trimmedWebhookUrl) return;

    const payload = {
        content: `New event published by ${organizerName || "Organizer"}: **${eventName || "Untitled Event"}**`,
        embeds: [
            {
                title: eventName || "New Event Published",
                description: eventDescription || "No description provided.",
                color: 3447003,
                fields: [
                    { name: "Organizer", value: organizerName || "Unknown Organizer", inline: true },
                    { name: "Type", value: eventType || "N/A", inline: true },
                    { name: "Registration Deadline", value: formatDateTime(registrationDeadline), inline: false },
                    { name: "Event Start", value: formatDateTime(eventStartDate), inline: true },
                    { name: "Event End", value: formatDateTime(eventEndDate), inline: true },
                ],
                timestamp: new Date().toISOString(),
            },
        ],
    };

    const response = await fetch(trimmedWebhookUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Discord webhook failed with status ${response.status}`);
    }
};
