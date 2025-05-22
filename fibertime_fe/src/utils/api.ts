const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const POST = 'POST';
const GET = 'GET';
const API_PRE_PATH_DEVICE = '/device';
const API_PRE_PATH_AUTH = '/auth';

export const generateTVCode = async () => {
    const response = await fetch(`${API_BASE_URL}${API_PRE_PATH_DEVICE}/create-device-code`, {
        method: POST,
        headers: {
            'Content-Type': 'application/json',
        },
    });
    return response.json();
};

export const requestOTP = async (phoneNumber: string) => {
    const response = await fetch(`${API_BASE_URL}${API_PRE_PATH_AUTH}/request-otp`, {
        method: POST,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber }),
    });
    return response.json();
};

export const login = async (phoneNumber: string, otp: string) => {
    const response = await fetch(`${API_BASE_URL}${API_PRE_PATH_AUTH}/login`, {
        method: POST,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber, otp }),
    });
    return response.json();
};

export const getDevice = async (deviceCode: string, token: string) => {
    const response = await fetch(`${API_BASE_URL}${API_PRE_PATH_DEVICE}/${deviceCode}`, {
        method: GET,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
    });
    return response.json();
};

export const connectDevice = async (deviceCode: string, phoneNumber: string, token: string) => {
    const response = await fetch(`${API_BASE_URL}${API_PRE_PATH_DEVICE}/connect-device`, {
        method: POST,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ deviceCode: deviceCode, phoneNumber: phoneNumber }),
    });
    return response.json();
};

export const checkConnectionStatus = async (deviceCode: string, token: string) => {
    const response = await fetch(`${API_BASE_URL}${API_PRE_PATH_DEVICE}/connection-status/${deviceCode}`, {
        method: GET,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
    });
    
    return response.json();
};