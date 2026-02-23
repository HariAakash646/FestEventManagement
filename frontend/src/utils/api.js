const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const apiCall = async (endpoint, method = "GET", body = null) => {
    const token = localStorage.getItem("token");
    const headers = {
        "Content-Type": "application/json",
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const options = {
        method,
        headers,
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_URL}${endpoint}`, options);
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
        const data = await response.json();
        if (!response.ok && data?.success === undefined) {
            return {
                success: false,
                message: data?.message || `Request failed with status ${response.status}`,
            };
        }
        return data;
    }

    const text = await response.text();
    if (!response.ok) {
        return {
            success: false,
            message: text || `Request failed with status ${response.status}`,
        };
    }
    return {
        success: true,
        data: text,
    };
};

export const apiCallFormData = async (endpoint, formData) => {
    const token = localStorage.getItem("token");
    const headers = {};
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers,
        body: formData,
    });

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
        const data = await response.json();
        if (!response.ok && data?.success === undefined) {
            return { success: false, message: data?.message || `Request failed with status ${response.status}` };
        }
        return data;
    }

    const text = await response.text();
    if (!response.ok) {
        return { success: false, message: text || `Request failed with status ${response.status}` };
    }
    return { success: true, data: text };
};
