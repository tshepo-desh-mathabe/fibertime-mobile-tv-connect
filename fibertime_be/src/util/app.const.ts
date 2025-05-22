
export type DeviceStatus = '' | 'active' | 'expired';

export const ConnectionStatus = {
    DEFAULT: 'inactive',
    ACTIVE: 'active',
    EXPIRED: 'expired',
} as const;

export type ConnectionStatusType = typeof ConnectionStatus[keyof typeof ConnectionStatus];


export const GenericConst = {
    PHONE_NUMBER_DEFUALT: '+0000000000'
};