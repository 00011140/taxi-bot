export interface DriverSession {
    phone?: string;
    token?: string;
    status?: "online" | "offline";
    currentRideId?: string;
}

export const driverSessions: Record<number, DriverSession> = {};
