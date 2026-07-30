/* ============================================================
   VAN DAM PAINTING — BUSINESS CONFIGURATION
   ============================================================
   This is the ONE file Jacob edits when verified business info
   becomes available. Anything set to null is hidden or replaced
   with honest neutral copy on the site — nothing is invented.
   ============================================================ */
window.VDP_CONFIG = {
  business: {
    name: "Van Dam Painting",
    phone: "+12692676801",          // verified — from the VanDam Painting Plus Facebook page
    phoneDisplay: "(269) 267-6801",
    email: null,                    // TODO(Jacob): real business email. null = email hidden, phone/text used instead
    address: "6606 Brigham Street, Portage, MI",
    town: "Portage, MI",
    region: "Southwest Michigan",
    facebook: "https://www.facebook.com/p/VanDam-Painting-Plus-61572407992698/",
  },

  // Stats shown in the numbers band. Values supplied by Jacob (July 2026).
  // Set any value to null to hide that stat entirely. Never invent numbers here.
  stats: [
    { value: 800, suffix: "+", label: "Projects Completed" },
    { value: 30,  suffix: "+", label: "Years of Craft" },
    { value: 2,   suffix: "",  label: "Van Dams on Every Job" },
    { value: 100, suffix: "%", label: "Family Owned" },
  ],

  // Verified customer reviews. Leave empty until real reviews exist —
  // the site shows an honest "ask us for references" section instead.
  // Format: { quote, name, job }   e.g. { quote:"…", name:"Sarah M.", job:"Interior · Portage" }
  reviews: [],

  // Exact workmanship-guarantee terms, once Bryan confirms them.
  // null = the site uses soft, truthful language ("final walkthrough on every job").
  guaranteeTerms: null,

  // Optional form endpoint (e.g. a free Formspree/Basin URL Jacob sets up).
  // null = the estimate form builds a text/call handoff instead of pretending to send.
  formEndpoint: null,
};
