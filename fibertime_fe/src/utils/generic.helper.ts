export function isNull(value): boolean {
    return value === null || value === undefined;
}


export function isErrorResponse(response): boolean {
    if (!isNull(response.message) && !isNull(response.statusCode)) {
        if (Array.isArray(response.message)) {
            alert(response.message[0]);
        } else {
            alert(`${response.message}`);
        }
        return true;
    }
    return false;
}