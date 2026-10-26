/*
 * Fixed answer wording per site locale. Templates hold no CV facts: every argument is a value
 * taken from the loaded JSON snapshot. They live here rather than in the XLF files because the
 * pure engine composes answers for an explicit locale (and is unit-tested in both locales);
 * the UI chrome around the answers (headings, buttons, fallback copy) uses Angular i18n.
 */
import { CertificationType, Locale, SourcedDate, SourcedPartialDate } from "../models/assistant.models";

export interface AnswerTemplates {
  readonly months: readonly string[];
  /** Reviewed translations of About hobby titles (the JSON stores them in English only). */
  readonly hobbyTitles: Readonly<Record<string, string>> | null;

  readonly labels: {
    readonly about: string;
    readonly education: string;
    readonly languages: string;
    topic(name: string): string;
    experience(company: string): string;
  };
  readonly excerpts: {
    readonly about: string;
    readonly experience: string;
    readonly post: string;
    topic(name: string): string;
  };

  ongoingRange(start: string): string;
  closedRange(start: string, end: string): string;

  employersIntro: string;
  employerItem(company: string, range: string): string;
  currentRole(role: string, company: string, start: string): string;
  currentRolesIntro: string;
  currentRoleItem(role: string, company: string, start: string): string;
  overviewHeadline(role: string, company: string): string;
  overviewPeriod(range: string): string;
  overviewLocation(place: string): string;
  companyRole(company: string, role: string): string;
  companyDatesClosed(company: string, start: string, end: string): string;
  companyDatesOngoing(company: string, start: string): string;
  companyLocation(company: string, place: string): string;
  technologiesIntro: string;
  technologyExperienceIntro(technology: string): string;
  technologyExperienceItem(company: string, role: string, range: string, listedAs: string | null): string;
  companyTechnologiesIntro(company: string): string;
  technologyAtCompany(technology: string, company: string): string;
  postsIntro: string;
  postSearchIntro: string;
  postItem(title: string, date: string): string;
  hobbiesIntro: string;
  socialLink(network: string, url: string): string;
  socialLinksIntro: string;
  socialLinkItem(network: string, url: string): string;
  educationIntro: string;
  educationItem(degree: string, field: string | null, school: string, period: string | null): string;
  readonly certificationTypes: Readonly<Record<CertificationType, string>>;
  certificationsIntro: string;
  issuerCertificationsIntro(issuer: string): string;
  certificationItem(name: string, type: string, issuer: string, issued: string, expires: string | null): string;
  languagesIntro: string;
  languageItem(name: string, proficiency: string): string;
  languageProficiency(name: string, proficiency: string): string;
  topicRolesIntro: string;
  topicRoleItem(company: string, role: string, range: string): string;
  companyHighlightsIntro(company: string): string;

  /**
   * One supported question per intent, used for suggestions, follow-up chips and "did you mean"
   * options. Each must be recognized by question-patterns.ts (the specs check it).
   */
  readonly questions: {
    readonly profile: string;
    readonly currentRole: string;
    readonly employers: string;
    readonly technologies: string;
    readonly posts: string;
    readonly hobbies: string;
    readonly socialLinks: string;
    readonly education: string;
    readonly certifications: string;
    readonly languages: string;
    companyOverview(company: string): string;
    companyRole(company: string): string;
    companyDates(company: string): string;
    companyLocation(company: string): string;
    companyTechnologies(company: string): string;
    technologyExperience(technology: string): string;
    technologyAtCompany(technology: string, company: string): string;
    postSearch(topic: string): string;
    postSummary(title: string): string;
    socialLink(network: string): string;
    issuerCertifications(issuer: string): string;
    languageProficiency(language: string): string;
    topicSummary(topic: string): string;
    companyHighlights(company: string): string;
  };
}

const EN: AnswerTemplates = {
  months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  hobbyTitles: null,
  labels: {
    about: "About me",
    education: "About me · Education",
    languages: "About me · Languages",
    topic: name => `About me · ${name}`,
    experience: company => `Experience · ${company}`
  },
  excerpts: {
    about: "From the About section of my CV",
    experience: "Role description from my CV",
    post: "Summary from my CV (the article itself is on the linked page)",
    topic: name => `Summary of my ${name} experience, from my CV`
  },
  ongoingRange: start => `since ${start} (listed as ongoing in my CV)`,
  closedRange: (start, end) => `${start} – ${end}`,
  employersIntro: "Companies listed in my CV, most recent first:",
  employerItem: (company, range) => `${company}: ${range}`,
  currentRole: (role, company, start) => `${role} at ${company}, since ${start}. My CV lists this role as ongoing (it has no end date).`,
  currentRolesIntro: "My CV lists these roles as ongoing (they have no end date):",
  currentRoleItem: (role, company, start) => `${role} at ${company}, since ${start}`,
  overviewHeadline: (role, company) => `${role} at ${company}`,
  overviewPeriod: range => `Period: ${range}`,
  overviewLocation: place => `Work location: ${place}`,
  companyRole: (company, role) => `My role at ${company}: ${role}.`,
  companyDatesClosed: (company, start, end) => `I worked at ${company} from ${start} to ${end}.`,
  companyDatesOngoing: (company, start) => `My role at ${company} started in ${start} and is listed as ongoing in my CV.`,
  companyLocation: (company, place) => `The work location listed for my role at ${company} is ${place}.`,
  technologiesIntro: "Technologies listed in the experience records of my CV. This is the CV's own list, not a complete inventory of my skills:",
  technologyExperienceIntro: technology => `Roles whose technology list in my CV includes ${technology}:`,
  technologyExperienceItem: (company, role, range, listedAs) =>
    `${company}, ${role}: ${range}${listedAs ? `; listed as ${listedAs}` : ""}`,
  companyTechnologiesIntro: company => `Technologies listed for my role at ${company}:`,
  technologyAtCompany: (technology, company) => `Yes. ${technology} is listed among the technologies of my role at ${company}.`,
  postsIntro: "Posts listed in my CV, newest first:",
  postSearchIntro: "Posts in my CV whose title or summary matches your search:",
  postItem: (title, date) => `${title} (${date})`,
  hobbiesIntro: "Hobbies listed in my CV:",
  socialLink: (network, url) => `My ${network} profile, as listed in my CV: ${url}`,
  socialLinksIntro: "Profiles listed in my CV:",
  socialLinkItem: (network, url) => `${network}: ${url}`,
  educationIntro: "Education listed in my CV:",
  educationItem: (degree, field, school, period) => `${degree}${field ? ` in ${field}` : ""}, ${school}${period ? ` (${period})` : ""}`,
  certificationTypes: { certification: "certification", course: "course certificate", badge: "badge" },
  certificationsIntro: "Certifications, course certificates and badges listed in my CV, newest first. The dates are issue dates, and the CV doesn't confirm that each one is still valid:",
  issuerCertificationsIntro: issuer => `Certifications, course certificates and badges from ${issuer} listed in my CV. The dates are issue dates, and the CV doesn't confirm that each one is still valid:`,
  certificationItem: (name, type, issuer, issued, expires) => `${name} (${type}), ${issuer}, issued ${issued}${expires ? `, expires ${expires}` : ""}`,
  languagesIntro: "Languages listed in my CV, with my self-reported level:",
  languageItem: (name, proficiency) => `${name}: ${proficiency}`,
  languageProficiency: (name, proficiency) => `My CV lists ${name}, with my self-reported level: ${proficiency}.`,
  topicRolesIntro: "Roles this summary covers:",
  topicRoleItem: (company, role, range) => `${company}, ${role}: ${range}`,
  companyHighlightsIntro: company => `Results listed for my role at ${company}:`,
  questions: {
    profile: "Tell me about your professional background.",
    currentRole: "What is your current role?",
    employers: "Which companies have you worked for?",
    technologies: "Which technologies are listed in your CV?",
    posts: "Which posts have you published?",
    hobbies: "What are your hobbies?",
    socialLinks: "What are your social media profiles?",
    education: "What did you study?",
    certifications: "Which certifications do you have?",
    languages: "Which languages do you speak?",
    companyOverview: company => `Tell me about your work at ${company}.`,
    companyRole: company => `What was your role at ${company}?`,
    companyDates: company => `When did you work at ${company}?`,
    companyLocation: company => `In which city did you work at ${company}?`,
    companyTechnologies: company => `Which technologies did you use at ${company}?`,
    technologyExperience: technology => `Where have you used ${technology}?`,
    technologyAtCompany: (technology, company) => `Did you use ${technology} at ${company}?`,
    postSearch: topic => `Do you have posts about ${topic}?`,
    postSummary: title => `What is your post "${title}" about?`,
    socialLink: network => `Where can I find your ${network} profile?`,
    issuerCertifications: issuer => `Which ${issuer} certifications do you have?`,
    languageProficiency: language => `Do you speak ${language}?`,
    topicSummary: topic => `Summarize your experience in ${topic}.`,
    companyHighlights: company => `What did you achieve at ${company}?`
  }
};

const PT: AnswerTemplates = {
  months: ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."],
  hobbyTitles: { Cycling: "Ciclismo", Gym: "Academia", Travel: "Viagens", Read: "Leitura" },
  labels: {
    about: "Sobre mim",
    education: "Sobre mim · Formação",
    languages: "Sobre mim · Idiomas",
    topic: name => `Sobre mim · ${name}`,
    experience: company => `Experiência · ${company}`
  },
  excerpts: {
    about: "Da seção Sobre mim do meu currículo",
    experience: "Descrição do cargo no meu currículo",
    post: "Resumo do meu currículo (o artigo completo está na página do link)",
    topic: name => `Resumo da minha experiência em ${name}, do meu currículo`
  },
  ongoingRange: start => `desde ${start} (listado como em andamento no meu currículo)`,
  closedRange: (start, end) => `${start} – ${end}`,
  employersIntro: "Empresas listadas no meu currículo, da mais recente para a mais antiga:",
  employerItem: (company, range) => `${company}: ${range}`,
  currentRole: (role, company, start) => `${role} na empresa ${company}, desde ${start}. Meu currículo lista este cargo como em andamento (sem data de término).`,
  currentRolesIntro: "Meu currículo lista estes cargos como em andamento (sem data de término):",
  currentRoleItem: (role, company, start) => `${role} na empresa ${company}, desde ${start}`,
  overviewHeadline: (role, company) => `${role} na empresa ${company}`,
  overviewPeriod: range => `Período: ${range}`,
  overviewLocation: place => `Local de trabalho: ${place}`,
  companyRole: (company, role) => `Meu cargo na empresa ${company}: ${role}.`,
  companyDatesClosed: (company, start, end) => `Trabalhei na empresa ${company} de ${start} a ${end}.`,
  companyDatesOngoing: (company, start) => `Meu cargo na empresa ${company} começou em ${start} e está listado como em andamento no meu currículo.`,
  companyLocation: (company, place) => `O local de trabalho listado para o meu cargo na empresa ${company} é ${place}.`,
  technologiesIntro: "Tecnologias listadas nas experiências do meu currículo. Esta é a lista do próprio currículo, não um inventário completo das minhas habilidades:",
  technologyExperienceIntro: technology => `Cargos cuja lista de tecnologias no meu currículo inclui ${technology}:`,
  technologyExperienceItem: (company, role, range, listedAs) =>
    `${company}, ${role}: ${range}${listedAs ? `; listado como ${listedAs}` : ""}`,
  companyTechnologiesIntro: company => `Tecnologias listadas para o meu cargo na empresa ${company}:`,
  technologyAtCompany: (technology, company) => `Sim. ${technology} está entre as tecnologias listadas para o meu cargo na empresa ${company}.`,
  postsIntro: "Artigos listados no meu currículo, do mais recente para o mais antigo:",
  postSearchIntro: "Artigos do meu currículo cujo título ou resumo corresponde à sua busca:",
  postItem: (title, date) => `${title} (${date})`,
  hobbiesIntro: "Hobbies listados no meu currículo:",
  socialLink: (network, url) => `Meu perfil no ${network}, conforme listado no meu currículo: ${url}`,
  socialLinksIntro: "Perfis listados no meu currículo:",
  socialLinkItem: (network, url) => `${network}: ${url}`,
  educationIntro: "Formação listada no meu currículo:",
  educationItem: (degree, field, school, period) => `${degree}${field ? ` em ${field}` : ""}, ${school}${period ? ` (${period})` : ""}`,
  certificationTypes: { certification: "certificação", course: "certificado de curso", badge: "badge" },
  certificationsIntro: "Certificações, certificados de curso e badges listados no meu currículo, do mais recente para o mais antigo. As datas são de emissão, e o currículo não confirma que cada um continua válido:",
  issuerCertificationsIntro: issuer => `Certificações, certificados de curso e badges de ${issuer} listados no meu currículo. As datas são de emissão, e o currículo não confirma que cada um continua válido:`,
  certificationItem: (name, type, issuer, issued, expires) => `${name} (${type}), ${issuer}, emitido em ${issued}${expires ? `, expira em ${expires}` : ""}`,
  languagesIntro: "Idiomas listados no meu currículo, com o nível que eu mesmo informei:",
  languageItem: (name, proficiency) => `${name}: ${proficiency}`,
  languageProficiency: (name, proficiency) => `Meu currículo lista ${name}, com o nível que eu mesmo informei: ${proficiency}.`,
  topicRolesIntro: "Cargos que este resumo abrange:",
  topicRoleItem: (company, role, range) => `${company}, ${role}: ${range}`,
  companyHighlightsIntro: company => `Resultados listados para o meu cargo na empresa ${company}:`,
  questions: {
    profile: "Fale sobre sua trajetória profissional.",
    currentRole: "Qual é o seu cargo atual?",
    employers: "Em quais empresas você trabalhou?",
    technologies: "Quais tecnologias estão listadas no seu currículo?",
    posts: "Quais artigos você publicou?",
    hobbies: "Quais são os seus hobbies?",
    socialLinks: "Quais são suas redes sociais?",
    education: "O que você estudou?",
    certifications: "Quais certificações você tem?",
    languages: "Quais idiomas você fala?",
    companyOverview: company => `Fale sobre o seu trabalho na ${company}.`,
    companyRole: company => `Qual era o seu cargo na ${company}?`,
    companyDates: company => `Quando você trabalhou na ${company}?`,
    companyLocation: company => `Em qual cidade você trabalhou na ${company}?`,
    companyTechnologies: company => `Quais tecnologias você usou na ${company}?`,
    technologyExperience: technology => `Onde você já usou ${technology}?`,
    technologyAtCompany: (technology, company) => `Você usou ${technology} na ${company}?`,
    postSearch: topic => `Você tem artigos sobre ${topic}?`,
    postSummary: title => `Sobre o que é o artigo "${title}"?`,
    socialLink: network => `Qual é o seu ${network}?`,
    issuerCertifications: issuer => `Quais certificações de ${issuer} você tem?`,
    languageProficiency: language => `Você fala ${language}?`,
    topicSummary: topic => `Resuma sua experiência em ${topic}.`,
    companyHighlights: company => `O que você conquistou na ${company}?`
  }
};

export const ANSWER_TEMPLATES: Readonly<Record<Locale, AnswerTemplates>> = { en: EN, pt: PT };

/** "May 2020" / "mai. 2020", from fixed tables (no Intl or runtime locale data). */
export function formatMonthYear(date: SourcedDate, locale: Locale): string {
  return `${ANSWER_TEMPLATES[locale].months[date.month - 1]} ${date.year}`;
}

/** "Jun 2022" for MM-YYYY, "2017" for a year alone: never more precise than the CV. */
export function formatPartialDate(date: SourcedPartialDate, locale: Locale): string {
  return date.month ? `${ANSWER_TEMPLATES[locale].months[date.month - 1]} ${date.year}` : String(date.year);
}
