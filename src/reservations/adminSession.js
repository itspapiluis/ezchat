// Remembers the admin PIN in memory only (never stored on disk) for the Reservations tab.
// It is set by the existing Admin login the moment the PIN is verified.
let pin = "";
export const setAdminPin = (p) => { pin = String(p || ""); };
export const getAdminPin = () => pin;
export const clearAdminPin = () => { pin = ""; };
