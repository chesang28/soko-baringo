import { whatsappLink } from "@/lib/format";
import { ChatIcon } from "./Icons";

export function WhatsAppFab({ phone }: { phone: string | null }) {
  if (!phone) return null;
  return (
    <a
      href={whatsappLink(phone, "Hello Soko Baringo, I'd like to ask about your produce.")}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-[#1f9d55] px-4 py-3 font-semibold text-white shadow-lg transition hover:bg-[#178246]"
    >
      <ChatIcon /> <span className="hidden sm:inline">Chat with us</span>
    </a>
  );
}
