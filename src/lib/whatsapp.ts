export function buildWhatsAppLink(phone: string, message: string): string {
  let digits = phone.replace(/\D/g, "");
  // Celular boliviano sin código de país (6xxxxxxx o 7xxxxxxx).
  if (/^[67]\d{7}$/.test(digits)) digits = `591${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
