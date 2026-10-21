// Validation d'adresses suisses : NPA à 4 chiffres (1000–9999).
export const isSwissZip = (z: string) => /^[1-9]\d{3}$/.test(z.trim());
export const normZip = (z: string) => z.trim();
