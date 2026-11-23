import { getDict } from "@/lib/i18n";
import { getSiteStats } from "@/lib/queries";
import { displayPhone } from "@/lib/format";

export const metadata = { title: "Privacy" };

export default async function PrivacyPage() {
  const [{ lang }, stats] = await Promise.all([getDict(), getSiteStats()]);
  const contact = stats.agent_phone ? displayPhone(stats.agent_phone) : "our agent";
  const en = [
    ["What we collect", "Your name, phone number, the produce you buy or sell, and delivery details you give us. Farmers: also your ward and village."],
    ["Why", "Only to handle your request: to call you, arrange delivery, and pay or charge the right amounts. We never sell your details."],
    ["Who sees it", "Only Soko Baringo staff and agents. Buyers do not see farmers' phone numbers on the website, and farmers do not see buyers' numbers."],
    ["How long", "As long as you use Soko Baringo, and for payment records as required by Kenyan law."],
    ["Your rights", `You can ask us to see, correct or delete your details at any time. Call or WhatsApp ${contact}.`],
  ];
  const sw = [
    ["Tunachokusanya", "Jina lako, nambari ya simu, mazao unayonunua au kuuza, na maelezo ya usafiri. Wakulima: pia wadi na kijiji."],
    ["Kwa nini", "Ili tu kushughulikia ombi lako: kukupigia, kupanga usafiri, na kulipa au kukutoza kiasi sahihi. Hatuuzi maelezo yako kamwe."],
    ["Nani anaona", "Wafanyakazi na mawakala wa Soko Baringo pekee. Wanunuzi hawaoni nambari za wakulima kwenye tovuti, na wakulima hawaoni za wanunuzi."],
    ["Kwa muda gani", "Muda wote unapotumia Soko Baringo, na kumbukumbu za malipo kama sheria ya Kenya inavyotaka."],
    ["Haki zako", `Unaweza kuomba kuona, kurekebisha au kufuta maelezo yako wakati wowote. Piga au tuma WhatsApp ${contact}.`],
  ];
  const items = lang === "sw" ? sw : en;
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-extrabold">{lang === "sw" ? "Faragha" : "Privacy"}</h1>
      <p className="mt-2 text-gray-600">{lang === "sw" ? "Tunalinda maelezo yako kwa mujibu wa Sheria ya Ulinzi wa Data ya Kenya, 2019." : "We protect your details in line with Kenya's Data Protection Act, 2019."}</p>
      <dl className="mt-6 space-y-4">
        {items.map(([k, v]) => <div key={k} className="rounded-2xl bg-white p-5 ring-1 ring-gray-200"><dt className="font-semibold">{k}</dt><dd className="mt-1 text-gray-700">{v}</dd></div>)}
      </dl>
    </div>
  );
}
