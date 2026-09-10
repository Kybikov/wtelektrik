import { de as german } from "./de.js";
export const kinds = [
  [
    "work",
    "Робота",
    "Arbeit / Stelle",
    "Працевлаштування за професією, зокрема Quereinstieg.",
  ],
  [
    "ausbildung",
    "Ausbildung",
    "Berufsausbildung",
    "Здобуття професії на підприємстві та в Berufsschule або у професійній школі.",
  ],
  [
    "umschulung",
    "Перенавчання",
    "Umschulung",
    "Здобуття нової професії, часто з іспитом IHK/HWK.",
  ],
  [
    "weiterbildung",
    "Підвищення кваліфікації",
    "Weiterbildung / Fortbildung",
    "Розвиток наявних професійних знань.",
  ],
  [
    "course",
    "Курси й сертифікати",
    "Kurs / Seminar / Zertifikat",
    "Короткі курси: SPS, KNX, EPLAN, вимірювання, електробезпека.",
  ],
  [
    "meister",
    "Meister",
    "Meister / Industriemeister",
    "Підготовка до кваліфікації майстра ремесла або промисловості.",
  ],
  [
    "techniker",
    "Techniker",
    "Staatlich geprüfter Techniker",
    "Фахове продовження освіти з електротехніки.",
  ],
  [
    "study",
    "Вища освіта",
    "Studium / duales Studium",
    "Бакалаврські, магістерські та дуальні програми.",
  ],
  [
    "praktikum",
    "Практика",
    "Praktikum / Schülerpraktikum",
    "Знайомство з професією та практичний досвід.",
  ],
  [
    "werkstudent",
    "Робота для студентів",
    "Werkstudent / Abschlussarbeit",
    "Робота під час навчання, дипломні проєкти.",
  ],
  [
    "trainee",
    "Стажування випускників",
    "Trainee",
    "Програми входження у професію після освіти.",
  ],
  [
    "eq",
    "Підготовка до Ausbildung",
    "Einstiegsqualifizierung / BvB",
    "Підготовчі можливості перед професійним навчанням.",
  ],
  [
    "tq",
    "Часткова кваліфікація",
    "Teilqualifizierung",
    "Послідовне опанування частин професії.",
  ],
  [
    "extern",
    "Підготовка до іспиту",
    "Externenprüfung",
    "Підготовка до професійного іспиту на основі практичного досвіду.",
  ],
  [
    "recognition",
    "Адаптація кваліфікації",
    "Anpassungsqualifizierung",
    "Навчання для усунення відмінностей іноземної кваліфікації.",
  ],
].map(([id, label, de, description]) => ({
  id,
  label: german[label] || label,
  ukLabel: label,
  de,
  description,
}));

export const categories = [
  [
    "installation",
    "Електромонтаж і будівлі",
    "Elektroniker Energie- und Gebäudetechnik|Elektriker|Elektroinstallateur|Elektromonteur|Elektrohelfer",
    "energie- und gebäudetechnik|elektroinstall|elektromont|elektriker|elektrohelfer|gebäudetechnik",
  ],
  [
    "industrial",
    "Промислова електрика",
    "Elektroniker für Betriebstechnik|Industrieelektriker|Betriebselektriker|Elektroanlagenmonteur",
    "betriebstechnik|betriebselektr|industrieelektr|elektroanlagen|instandhaltung",
  ],
  [
    "automation",
    "Автоматизація й SPS",
    "Elektroniker für Automatisierungstechnik|Elektroniker Automatisierungs- und Systemtechnik|SPS-Programmierer|Automatisierungstechniker",
    "automatisierung|sps|tia portal|simatic|codesys|regelungstechnik|robotik",
  ],
  [
    "smart",
    "Розумні будівлі та KNX",
    "Elektroniker für Gebäudesystemintegration|Gebäudeautomation|KNX-Techniker|MSR-Techniker",
    "gebäudesystem|gebäudeautomation|knx|msr|smart home|infrastruktursystem",
  ],
  [
    "electronics",
    "Електроніка та прилади",
    "Elektroniker für Geräte und Systeme|Elektroniker für Informations- und Systemtechnik|Mikrotechnologe|Prüftechniker Elektronik",
    "geräte und systeme|informations- und systemtechnik|mikrotechnolog|elektronik|leiterplatten|embedded|halbleiter",
  ],
  [
    "drives",
    "Двигуни та приводи",
    "Elektroniker für Maschinen und Antriebstechnik|Antriebstechniker|Elektromaschinenbauer",
    "antriebstechnik|elektromaschinen|wickler|frequenzumrichter",
  ],
  [
    "energy",
    "Енергетика та мережі",
    "Energietechniker|Netzmonteur Strom|Schaltanlagenmonteur|Hochspannungstechniker|Kabelmonteur",
    "energietechnik|netzmonteur|schaltanlagen|hochspannung|mittelspannung|kabelmonteur|umspannwerk",
  ],
  [
    "renewables",
    "Сонячна та вітрова енергія",
    "Elektriker Photovoltaik|Solartechniker|Servicetechniker Windenergie|Speichertechniker",
    "photovoltaik|solartechnik|windenergie|windkraft|energiespeicher|erneuerbare",
  ],
  [
    "mobility",
    "Електромобільність і залізниця",
    "Ladeinfrastruktur-Techniker|Kfz-Mechatroniker System- und Hochvolttechnik|Oberleitungsmonteur|Signalmechaniker",
    "ladeinfrastruktur|elektromobil|hochvolt|oberleitung|signalmechanik|leit- und sicherungstechnik",
  ],
  [
    "it",
    "Мережі та комунікації",
    "IT-System-Elektroniker|Informationselektroniker|Fernmeldetechniker|Glasfasermonteur",
    "it-system-elektr|informationselektr|fernmelde|glasfaser|nachrichtentechnik",
  ],
  [
    "service",
    "Сервіс, монтаж і ремонт",
    "Servicetechniker Elektrotechnik|Inbetriebnehmer|Kundendiensttechniker|Haustechniker Elektro",
    "servicetechnik|inbetriebnehm|kundendienst|haustechnik|wartung",
  ],
  [
    "safety",
    "Вимірювання та електробезпека",
    "Prüftechniker DGUV V3|Elektrofachkraft|VEFK|Elektrotechnisch unterwiesene Person|EFKffT",
    "dguv|elektrofachkraft|schaltberechtigung|prüftechnik|messtechnik|eup|efkfft|vde",
  ],
  [
    "engineering",
    "Інженерія, проєкти та EPLAN",
    "Elektroingenieur|Elektrokonstrukteur|Elektroplaner|Technischer Systemplaner Elektrotechnische Systeme|Projektleiter Elektrotechnik",
    "elektroingenieur|electrical engineer|elektrokonstruk|elektroplan|eplan|systemplaner|projektleiter|bauleiter",
  ],
  [
    "mechatronics",
    "Мехатроніка та суміжні напрями",
    "Mechatroniker|Mechatroniker für Kältetechnik|Fluggerätelektroniker|Automatenfachmann|Elektroniker für luftfahrttechnische Systeme",
    "mechatronik|kältetechnik|fluggeräteelektr|luftfahrttechnische|automatenfach",
  ],
  [
    "general",
    "Електротехніка загалом",
    "Elektrotechniker|Elektrotechnischer Assistent|Elektrotechnikermeister|Industriemeister Elektrotechnik",
    "elektrotech|elektroniker|elektrisch|electrical",
  ],
].map(([id, label, names, patterns]) => ({
  id,
  label: german[label] || label,
  ukLabel: label,
  names: names.split("|"),
  patterns: patterns.split("|"),
}));

export const modes = [
  { id: "online", label: "Онлайн / віддалено" },
  { id: "offline", label: "Офлайн / на місці" },
  { id: "hybrid", label: "Гібрид" },
  { id: "unknown", label: "Формат не вказано" },
];
export const travels = [
  { id: "long", label: "Довгі поїздки / монтаж" },
  { id: "occasional", label: "Іноді виїзди" },
  { id: "none", label: "Без поїздок" },
  { id: "unknown", label: "Поїздки не вказані" },
];
export const references = [
  {
    name: "BIBB — офіційні професії",
    url: "https://www.bibb.de/dienst/berufesuche/de/index_berufesuche.php/groups_of_occupations/",
  },
  {
    name: "Bundesagentur — електротехнічні професії",
    url: "https://www.arbeitsagentur.de/datei/elektro_ba038502.pdf",
  },
  {
    name: "mein NOW — формати Weiterbildung",
    url: "https://web.arbeitsagentur.de/weiterbildungssuche/",
  },
  {
    name: "DGUV — кваліфікації в електротехніці",
    url: "https://publikationen.dguv.de/regelwerk/dguv-informationen/313/elektrofachkraefte",
  },
  {
    name: "Визнання іноземної кваліфікації",
    url: "https://www.anerkennung-in-deutschland.de/html/de/pro/moeglichkeiten-qualifizierung.php",
  },
  {
    name: "IHK — Industriemeister Elektrotechnik",
    url: "https://www.ihk.de/nordwestfalen/bildung/fortbildungspruefungen/a-z/industriemeister-elektrotechnik-3595450",
  },
];
