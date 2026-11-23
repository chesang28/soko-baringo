import { cookies } from "next/headers";

export type Lang = "en" | "sw";

const en = {
  nav: { buy: "Buy produce", needs: "Buyer requests", prices: "Prices", sell: "Sell with us", agent: "Agent" },
  tagline: "Farm-fresh from Baringo County",
  footer: {
    about: "Connecting Baringo farmers directly to buyers. Fair prices, fresh produce, less waste.",
    buyers: "Buyers", farmers: "Farmers", browse: "Browse produce", post: "Post what you need", payment: "How payment works",
    prices: "Weekly prices",
  },
  hero: {
    pill: "Kabarnet · Kerio Valley · Marigat",
    title1: "Fresh from Baringo farms.", title2: "Fair for every farmer.",
    body: "Buy mangoes, pure Baringo honey and more straight from verified local farmers. No middlemen, no waste, honest prices.",
    buy: "Buy produce →", farmer: "I'm a farmer",
    farmers: "Verified farmers", wards: "Wards served", listings: "Listings live now", deliveries: "Deliveries made", rating: "Buyer rating",
  },
  shopBy: "Shop by produce", available: "available", comingSoon: "Coming soon", availableNow: "Available now", seeAll: "See all →",
  emptyListings: "New harvests are being added. Check back soon.",
  bulk: {
    title: "Need a large quantity or next season's harvest?",
    body: "Post what you need, including bookings for the next harvest, and farmers will respond with offers.",
    cta: "Post a request", see: "See open requests",
  },
  how: {
    buyers: "For buyers", farmers: "For farmers",
    b: ["Browse fresh produce with clear prices", "Send a request. No account, no upfront payment", "We confirm by phone and arrange delivery", "Receive and pay by M-Pesa or cash"],
    f: ["An agent visits and registers you for free", "We list your harvest and find buyers", "We arrange collection and transport", "You get paid by M-Pesa and keep 95%"],
  },
  why: [
    ["Verified farmers", "Every farmer is visited and registered by our agent."],
    ["Graded & photographed", "Real photos and quality grades, so you know what you get."],
    ["Fair, clear prices", "Farmers keep 95% of every sale. You pay no hidden markups."],
    ["Delivery arranged", "Pickup in Baringo or scheduled trucks to your town."],
  ],
  reviews: { title: "What buyers say", from: "from" },
  sellSection: {
    kicker: "For farmers", title: "Sell your harvest at a fair price",
    body: "Stop losing mangoes to rot and honey to low middleman prices. We bring the buyers. You keep 95%.",
    points: ["Free registration. No smartphone needed", "Paid by M-Pesa after delivery", "Group and co-op harvests welcome"],
    formTitle: "Leave your details and we'll visit you",
  },
  faq: {
    title: "Questions",
    items: [
      ["How do I pay?", "You don't pay when you send a request. Our agent calls to confirm the price, quantity and delivery, then you pay by M-Pesa or cash as agreed."],
      ["Can you deliver outside Baringo?", "Yes. We run scheduled trucks to towns like Nakuru, Eldoret and Nairobi. Put your town in the request note and we'll quote delivery."],
      ["Is there a minimum order?", "No. We serve households, traders, hotels and processors. For large or seasonal quantities, post a buyer request."],
      ["How do farmers get paid?", "Farmers receive their share by M-Pesa after delivery. Soko Baringo keeps a small 5% service fee, so farmers keep 95% of the sale."],
    ],
  },
  card: { readyNow: "Ready now", ready: "Ready", per: "per", available: "available", verified: "Verified farmer", grade: "Grade" },
  listings: {
    title: "Fresh produce", sub: "Direct from verified farmers in Baringo County. Send a request and we'll call you to confirm.",
    all: "All", count: "available", none: "Nothing listed here right now", noneSub: "New harvests are added every week. Check back soon.",
  },
  detail: {
    back: "← All produce", available: "Available", ready: "Ready", now: "Now", pickup: "Pickup",
    verified: "Verified farmer, registered in person by our agent", delivery: "or delivery to your town",
    request: "Request to buy", gradeA: "Grade A: top quality, uniform size", gradeB: "Grade B: good quality, mixed size", gradeC: "Grade C: for processing / juice",
  },
  order: {
    howMany: "How many", estimate: "Estimated total", name: "Your name", phone: "Phone number", business: "Business name",
    note: "Delivery town or note", optional: "(optional)", notePh: "e.g. Deliver to Nakuru by Friday", send: "Send request",
    noPay: "No payment now. We call you to confirm first.", upTo: "Up to",
    sent: "Request sent!", ref: "Your reference number",
    steps: ["Our agent calls you to confirm price & delivery", "Produce is collected from the farmer", "You receive it and pay as agreed"],
    track: "Track your request", whatsapp: "Message us on WhatsApp", more: "Browse more produce", save: "Save the tracking link to check your request status anytime.",
  },
  lead: {
    name: "Your name", phone: "Phone number", ward: "Ward / village", wardPh: "e.g. Kabartonjo", grow: "What do you grow?", growPh: "e.g. Mangoes, honey",
    submit: "Ask an agent to visit me",
  },
  track: {
    ref: "Reference", pickup: "Pickup", requested: "requested", cancelled: "This request was cancelled. Contact us if you think this is a mistake.",
    steps: [["Request received", "We've got your request."], ["Agent in touch", "Our agent is confirming details with you."], ["Confirmed", "Price and delivery agreed. We're collecting your produce."], ["Delivered", "Your produce has been delivered."], ["Completed", "Paid in full. Thank you!"]],
    rate: "How was your order?", rateSub: "Your rating helps other buyers and rewards good farmers.", comment: "Comment (optional)", submitReview: "Submit rating",
    thanks: "Thank you for your rating!",
  },
  needs: {
    title: "Buyer requests", sub: "Buyers looking for produce, including bookings for the next harvest. Farmers: tap \"I can supply\" to make an offer.",
    post: "Post what you need", none: "No open requests right now.",
    product: "Product", quantity: "Quantity", unit: "Unit", maxPrice: "Max price per unit (KES)", neededBy: "Needed by", location: "Delivery town",
    name: "Your name", phone: "Phone number", business: "Business name", note: "Details", optional: "(optional)",
    submit: "Post request", posted: "Request posted! We'll call you as offers come in.",
    needed: "needed by", upTo: "up to", offers: "offers", supply: "I can supply", offer: "Send offer", yourPrice: "Your price per unit (KES)",
    offerSent: "Offer sent! Our agent will contact you.", business_: "Business", individual: "Individual", in: "in",
  },
  prices: {
    title: "Produce prices", sub: "Live prices from Soko Baringo listings and sales in the last 30 days. Updated automatically.",
    product: "Product", listedNow: "Listed now", range: "Range", sold30: "Avg sold (30 days)", trend: "vs previous 30 days", volume: "Sold (30 days)",
    none: "Prices appear once produce is listed.", per: "per",
  },
  alert: {
    title: "Get notified when it's in stock", sub: "Leave your number and we'll contact you as soon as a farmer lists it.",
    name: "Your name", phone: "Phone number", submit: "Notify me", done: "Done! We'll contact you when it's available.",
  },
  chat: "Chat with us",
};

type Dict = typeof en;

const sw: Dict = {
  nav: { buy: "Nunua mazao", needs: "Maombi ya wanunuzi", prices: "Bei", sell: "Uza nasi", agent: "Wakala" },
  tagline: "Mazao safi kutoka Kaunti ya Baringo",
  footer: {
    about: "Tunaunganisha wakulima wa Baringo moja kwa moja na wanunuzi. Bei za haki, mazao safi, hasara kidogo.",
    buyers: "Wanunuzi", farmers: "Wakulima", browse: "Tazama mazao", post: "Tuma mahitaji yako", payment: "Jinsi ya kulipa",
    prices: "Bei za wiki",
  },
  hero: {
    pill: "Kabarnet · Bonde la Kerio · Marigat",
    title1: "Mazao safi kutoka mashamba ya Baringo.", title2: "Haki kwa kila mkulima.",
    body: "Nunua maembe, asali halisi ya Baringo na mengine moja kwa moja kutoka kwa wakulima waliothibitishwa. Bila madalali, bila hasara, bei za haki.",
    buy: "Nunua mazao →", farmer: "Mimi ni mkulima",
    farmers: "Wakulima waliothibitishwa", wards: "Wadi tunazohudumia", listings: "Mazao yaliyopo sasa", deliveries: "Mizigo iliyofikishwa", rating: "Ukadiriaji wa wanunuzi",
  },
  shopBy: "Chagua kwa zao", available: "yapo", comingSoon: "Yanakuja hivi karibuni", availableNow: "Yaliyopo sasa", seeAll: "Tazama yote →",
  emptyListings: "Mavuno mapya yanaongezwa. Rudi baadaye.",
  bulk: {
    title: "Unahitaji kiasi kikubwa au mavuno ya msimu ujao?",
    body: "Tuma mahitaji yako, ikiwemo kuweka oda ya mavuno yajayo, na wakulima watakutumia ofa.",
    cta: "Tuma ombi", see: "Tazama maombi yaliyopo",
  },
  how: {
    buyers: "Kwa wanunuzi", farmers: "Kwa wakulima",
    b: ["Tazama mazao safi na bei wazi", "Tuma ombi. Hakuna akaunti, hakuna malipo ya mapema", "Tunathibitisha kwa simu na kupanga usafiri", "Pokea na ulipe kwa M-Pesa au pesa taslimu"],
    f: ["Wakala anakutembelea na kukusajili bure", "Tunaorodhesha mavuno yako na kutafuta wanunuzi", "Tunapanga ukusanyaji na usafiri", "Unalipwa kwa M-Pesa na unabaki na 95%"],
  },
  why: [
    ["Wakulima waliothibitishwa", "Kila mkulima anatembelewa na kusajiliwa na wakala wetu."],
    ["Picha na viwango vya ubora", "Picha halisi na viwango vya ubora, ujue unachopata."],
    ["Bei za haki na wazi", "Wakulima wanabaki na 95% ya kila mauzo. Hakuna nyongeza za siri."],
    ["Usafiri unapangwa", "Chukua Baringo au malori ya ratiba hadi mji wako."],
  ],
  reviews: { title: "Wanunuzi wanasema", from: "kutoka" },
  sellSection: {
    kicker: "Kwa wakulima", title: "Uza mavuno yako kwa bei ya haki",
    body: "Acha kupoteza maembe yanayooza na asali kwa bei ndogo za madalali. Tunaleta wanunuzi. Unabaki na 95%.",
    points: ["Usajili ni bure. Huhitaji simu janja", "Unalipwa kwa M-Pesa baada ya kufikisha", "Mavuno ya vikundi na vyama vya ushirika yanakaribishwa"],
    formTitle: "Acha maelezo yako na tutakutembelea",
  },
  faq: {
    title: "Maswali",
    items: [
      ["Nalipaje?", "Hulipi unapotuma ombi. Wakala wetu anakupigia kuthibitisha bei, kiasi na usafiri, kisha unalipa kwa M-Pesa au pesa taslimu kama mlivyokubaliana."],
      ["Mnafikisha nje ya Baringo?", "Ndiyo. Tuna malori ya ratiba kwenda Nakuru, Eldoret na Nairobi. Andika mji wako kwenye ombi na tutakupa bei ya usafiri."],
      ["Kuna oda ya chini kabisa?", "Hapana. Tunahudumia nyumba, wafanyabiashara, hoteli na viwanda. Kwa kiasi kikubwa au cha msimu, tuma ombi la mnunuzi."],
      ["Wakulima wanalipwaje?", "Wakulima wanapokea sehemu yao kwa M-Pesa baada ya kufikisha. Soko Baringo inachukua ada ndogo ya 5%, mkulima anabaki na 95%."],
    ],
  },
  card: { readyNow: "Tayari sasa", ready: "Tayari", per: "kwa", available: "yapo", verified: "Mkulima amethibitishwa", grade: "Daraja" },
  listings: {
    title: "Mazao safi", sub: "Moja kwa moja kutoka kwa wakulima waliothibitishwa Baringo. Tuma ombi na tutakupigia kuthibitisha.",
    all: "Yote", count: "yapo", none: "Hakuna mazao hapa kwa sasa", noneSub: "Mavuno mapya yanaongezwa kila wiki. Rudi baadaye.",
  },
  detail: {
    back: "← Mazao yote", available: "Yaliyopo", ready: "Tayari", now: "Sasa", pickup: "Mahali pa kuchukua",
    verified: "Mkulima amethibitishwa, amesajiliwa ana kwa ana na wakala wetu", delivery: "au tunafikisha mji wako",
    request: "Omba kununua", gradeA: "Daraja A: ubora wa juu, ukubwa sawa", gradeB: "Daraja B: ubora mzuri, ukubwa mchanganyiko", gradeC: "Daraja C: kwa usindikaji / juisi",
  },
  order: {
    howMany: "Ngapi", estimate: "Jumla inayokadiriwa", name: "Jina lako", phone: "Nambari ya simu", business: "Jina la biashara",
    note: "Mji wa kufikisha au maelezo", optional: "(si lazima)", notePh: "mf. Fikisha Nakuru kabla ya Ijumaa", send: "Tuma ombi",
    noPay: "Hakuna malipo sasa. Tutakupigia kwanza kuthibitisha.", upTo: "Hadi",
    sent: "Ombi limetumwa!", ref: "Nambari yako ya kumbukumbu",
    steps: ["Wakala wetu anakupigia kuthibitisha bei na usafiri", "Mazao yanakusanywa kutoka kwa mkulima", "Unapokea na kulipa kama mlivyokubaliana"],
    track: "Fuatilia ombi lako", whatsapp: "Tuandikie WhatsApp", more: "Tazama mazao zaidi", save: "Hifadhi kiungo hiki ufuatilie ombi lako wakati wowote.",
  },
  lead: {
    name: "Jina lako", phone: "Nambari ya simu", ward: "Wadi / kijiji", wardPh: "mf. Kabartonjo", grow: "Unalima nini?", growPh: "mf. Maembe, asali",
    submit: "Omba wakala anitembelee",
  },
  track: {
    ref: "Kumbukumbu", pickup: "Mahali pa kuchukua", requested: "iliombwa", cancelled: "Ombi hili lilighairiwa. Wasiliana nasi kama unadhani ni kosa.",
    steps: [["Ombi limepokelewa", "Tumepokea ombi lako."], ["Wakala anawasiliana", "Wakala wetu anathibitisha maelezo nawe."], ["Limethibitishwa", "Bei na usafiri vimekubaliwa. Tunakusanya mazao yako."], ["Limefikishwa", "Mazao yako yamefikishwa."], ["Limekamilika", "Limelipwa kikamilifu. Asante!"]],
    rate: "Oda yako ilikuwaje?", rateSub: "Ukadiriaji wako unasaidia wanunuzi wengine na kutuza wakulima wazuri.", comment: "Maoni (si lazima)", submitReview: "Tuma ukadiriaji",
    thanks: "Asante kwa ukadiriaji wako!",
  },
  needs: {
    title: "Maombi ya wanunuzi", sub: "Wanunuzi wanaotafuta mazao, ikiwemo oda za mavuno yajayo. Wakulima: bonyeza \"Naweza kusambaza\" kutuma ofa.",
    post: "Tuma mahitaji yako", none: "Hakuna maombi kwa sasa.",
    product: "Zao", quantity: "Kiasi", unit: "Kipimo", maxPrice: "Bei ya juu kwa kipimo (KES)", neededBy: "Inahitajika kabla ya", location: "Mji wa kufikisha",
    name: "Jina lako", phone: "Nambari ya simu", business: "Jina la biashara", note: "Maelezo", optional: "(si lazima)",
    submit: "Tuma ombi", posted: "Ombi limetumwa! Tutakupigia ofa zikija.",
    needed: "inahitajika kabla ya", upTo: "hadi", offers: "ofa", supply: "Naweza kusambaza", offer: "Tuma ofa", yourPrice: "Bei yako kwa kipimo (KES)",
    offerSent: "Ofa imetumwa! Wakala wetu atawasiliana nawe.", business_: "Biashara", individual: "Mtu binafsi", in: "huko",
  },
  prices: {
    title: "Bei za mazao", sub: "Bei halisi kutoka kwa mazao ya Soko Baringo na mauzo ya siku 30 zilizopita. Zinasasishwa kiotomatiki.",
    product: "Zao", listedNow: "Bei sasa", range: "Kiwango", sold30: "Wastani wa mauzo (siku 30)", trend: "dhidi ya siku 30 zilizopita", volume: "Kilichouzwa (siku 30)",
    none: "Bei zitaonekana mazao yakiorodheshwa.", per: "kwa",
  },
  alert: {
    title: "Pata taarifa yakipatikana", sub: "Acha nambari yako na tutakujulisha mara tu mkulima atakapoorodhesha.",
    name: "Jina lako", phone: "Nambari ya simu", submit: "Nijulishe", done: "Tayari! Tutakujulisha yakipatikana.",
  },
  chat: "Ongea nasi",
};

export type { Dict };
const DICTS: Record<Lang, Dict> = { en, sw };

export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get("lang")?.value;
  return c === "sw" ? "sw" : "en";
}

export async function getDict(): Promise<{ lang: Lang; t: Dict }> {
  const lang = await getLang();
  return { lang, t: DICTS[lang] };
}
