import QRCode from "qrcode";

export const generateQrDataUrlFromPayload = async (payload) => {
    const payloadString = JSON.stringify(payload);
    return QRCode.toDataURL(payloadString, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 320,
    });
};
