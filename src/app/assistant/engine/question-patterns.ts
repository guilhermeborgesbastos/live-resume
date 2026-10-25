/*
 * The reviewed, finite set of question forms the assistant recognizes. Each pattern must match
 * the WHOLE normalized question (accent- and case-folded, terminal punctuation removed, see
 * normalize-question.ts). Slots capture only declared entities, which resolve-question.ts then
 * resolves against the loaded CV data; an unresolvable slot rejects the pattern.
 *
 * Questions may use either language's patterns; answers always follow the site's locale.
 * Add a form only together with positive and negative fixtures in assistant-engine.spec.ts.
 */
import { IntentId, Locale } from "../models/assistant.models";

export type SlotName = "company" | "technology" | "topic" | "title" | "network";

export interface QuestionPattern {
  readonly intent: IntentId;
  readonly language: Locale;
  readonly regex: RegExp;
}

const SLOTS: Readonly<Record<SlotName, string>> = {
  company: "(?<company>.+?)",
  technology: "(?<technology>.+?)",
  topic: "(?<topic>.+?)",
  title: "(?<title>.+?)",
  network: "(?<network>.+?)"
};

// Polite openings and closings allowed around any English/Portuguese question.
const EN_PREFIX = "(?:(?:hi|hello|hey)[, ]+)?(?:please,? )?(?:(?:can|could|would) you (?:please )?(?:tell me|let me know),? |i(?:'d| would) like to know,? )?";
const EN_SUFFIX = "(?:,? please)?";
const PT_PREFIX = "(?:(?:oi|ola)[, ]+)?(?:por favor,? )?(?:(?:voce|vc) (?:pode|poderia) me (?:dizer|contar),? |(?:pode|poderia) me (?:dizer|contar),? |gostaria de saber,? |me diga,? )?";
const PT_SUFFIX = "(?:,? por favor)?";

// Shared building blocks.
const WHAT_IS = "(?:what is|what's|whats)";
const WHAT_ARE = "(?:what are|what're)";
const CV = "(?:cv|resume|curriculum)";
const AT = "(?:at|with|for|in)";
const YOU = "(?:voce|vc)";
const PT_AT = "(?:na|no|em|pela|pelo|com a|com o)";
const PT_CV = "(?:curriculo|cv)";
const TELL_PT = "(?:me )?(?:fale|fala|conte|conta)(?:-me)?(?: um pouco)?";

const EN: Readonly<Record<IntentId, readonly string[]>> = {
  profile: [
    "tell me about (?:your )?(?:professional )?(?:background|profile|career)",
    "tell me about yourself",
    `(?:${WHAT_IS}|describe) your (?:professional )?(?:background|profile|summary)`,
    "who are you",
    "introduce yourself",
    "(?:give me|share) (?:a |an )?(?:summary|overview) of your (?:professional )?(?:background|profile|career)"
  ],
  employers: [
    "(?:which|what) companies (?:have you worked|did you work|you have worked|you've worked) (?:for|at|with)",
    `(?:which|what) companies are (?:listed )?in your ${CV}`,
    "where have you worked",
    "who have you worked for",
    "(?:list|show me|name) (?:your|the) (?:employers|companies(?: (?:you have|you've) worked (?:for|at))?)",
    `(?:who are|${WHAT_ARE}) your (?:previous |past |former )?employers`,
    `(?:${WHAT_IS}|show me) your (?:work|employment|professional) history`
  ],
  currentRole: [
    `${WHAT_IS} your (?:current|present) (?:role|job|position|job title|title)`,
    "(?:where|who) do you (?:currently )?work(?: for)?(?: now| currently| at the moment| today)?",
    "where are you (?:currently )?working(?: now)?",
    `(?:${WHAT_IS}|who is) your (?:current|present) (?:employer|company)`,
    "what do you (?:currently )?do(?: now| for a living)?"
  ],
  companyOverview: [
    `tell me about your (?:work|role|job|time|experience|position) ${AT} {company}`,
    "tell me about {company}",
    "what did you do (?:at|for|in) {company}",
    "what do you do (?:at|for) {company}",
    `(?:describe|summarize) your (?:work|role|experience|job) ${AT} {company}`
  ],
  companyRole: [
    `what (?:was|is) your (?:role|position|job title|title|job) ${AT} {company}`,
    "what (?:did|do) you work as (?:at|in|for) {company}",
    "what role did you have (?:at|in|with) {company}"
  ],
  companyDates: [
    `when did you work ${AT} {company}`,
    "(?:during )?(?:which|what) (?:period|years|dates) did you work (?:at|for|with) {company}",
    `${WHAT_ARE} (?:the )?(?:dates|period) of your (?:work|role|job) (?:at|for|with) {company}`
  ],
  companyLocation: [
    "where was your (?:role|job|work|position) (?:at|with|for) {company}(?: located| based)?",
    `${WHAT_IS} the (?:work )?location of your (?:role|job|work|position) (?:at|with|for) {company}`,
    "(?:in )?(?:which|what) city did you work (?:at|for|with) {company}",
    "where did you work (?:at|for) {company}"
  ],
  technologies: [
    `(?:which|what) technologies are (?:listed )?in your ${CV}`,
    "(?:which|what) (?:technologies|tools|tech) (?:have you used|have you worked with|did you use|did you work with)",
    `${WHAT_IS} your (?:tech|technology) stack`,
    "(?:list|show me) (?:your|the) technologies",
    `${WHAT_ARE} your technical skills`
  ],
  technologyExperience: [
    "where (?:have you|did you) (?:used|use|worked with|work with) {technology}",
    "(?:have you|did you) (?:ever )?(?:used|use|worked with|work with) {technology}",
    "do you have (?:any )?experience (?:with|in|using) {technology}",
    "(?:in )?(?:which|what) (?:companies|roles|jobs|positions) (?:have you|did you) (?:used|use|worked with|work with) {technology}",
    "(?:which|what) (?:roles|jobs|positions|companies) (?:used|involved|included) {technology}"
  ],
  companyTechnologies: [
    `(?:which|what) (?:technologies|tools|tech) (?:did you|do you) (?:use|work with) ${AT} {company}`,
    `(?:${WHAT_IS}|what was) your (?:tech|technology) stack ${AT} {company}`,
    "(?:which|what) technologies are listed for (?:your (?:role|job|work) (?:at|with) )?{company}"
  ],
  technologyAtCompany: [
    `did you (?:use|work with) {technology} ${AT} {company}`,
    `was {technology} used ${AT} {company}`
  ],
  posts: [
    "(?:which|what) (?:posts|articles) (?:have you|did you) (?:published|written|publish|write)",
    "(?:list|show me) (?:your|the) (?:posts|articles)",
    `${WHAT_ARE} your (?:posts|articles)`,
    `(?:which|what) (?:posts|articles) are (?:listed )?in your ${CV}`,
    "have you (?:published|written) (?:any )?(?:posts|articles)"
  ],
  postSearch: [
    "do you have (?:any )?(?:posts|articles) (?:about|on) {topic}",
    "have you (?:written|published) (?:any )?(?:posts |articles )?(?:about|on) {topic}",
    "(?:which|what) (?:posts|articles) (?:are|talk|did you write) (?:about|on) {topic}",
    "(?:show me|list|find) (?:your )?(?:posts|articles) (?:about|on) {topic}",
    "are there (?:any )?(?:posts|articles) (?:about|on) {topic}"
  ],
  postSummary: [
    `${WHAT_IS} (?:your|the) (?:post|article) {title} about`,
    "(?:summarize|tell me about) (?:your|the) (?:post|article) {title}",
    "what does (?:your|the) (?:post|article) {title} (?:cover|talk about)"
  ],
  hobbies: [
    `${WHAT_ARE} your hobbies(?: and interests)?`,
    "(?:which|what) hobbies do you have",
    "what do you (?:do|like to do|enjoy doing) in your (?:free|spare) time",
    "do you have (?:any )?hobbies",
    `${WHAT_ARE} your interests outside (?:of )?work`
  ],
  socialLink: [
    "where can i find (?:you on |your ){network}(?: profile| account| page)?",
    `(?:${WHAT_IS}|share) your {network}(?: profile| account| url| link| page)?`,
    `${WHAT_IS} the link to your {network}(?: profile| account| page)?`,
    "do you have (?:a |an )?{network} (?:profile|account|page)",
    "are you on {network}"
  ],
  socialLinks: [
    `${WHAT_ARE} your social (?:media|networks?)(?: profiles| links| accounts)?`,
    "where can i find you online",
    "(?:list|show me) your (?:social media |social )?(?:profiles|links)"
  ]
};

const PT: Readonly<Record<IntentId, readonly string[]>> = {
  profile: [
    `${TELL_PT} sobre (?:a )?(?:sua )?(?:trajetoria|carreira|experiencia) profissional`,
    `${TELL_PT} sobre (?:voce|vc|ti)`,
    `quem e ${YOU}`,
    "qual (?:e )?(?:a )?(?:sua )?(?:trajetoria|carreira) profissional",
    "qual (?:e )?(?:o )?seu perfil(?: profissional)?",
    "apresente-se"
  ],
  employers: [
    `(?:em|para) (?:quais|que) empresas ${YOU} (?:ja )?trabalhou`,
    `quais empresas (?:estao|aparecem) (?:listadas )?no seu ${PT_CV}`,
    `onde ${YOU} (?:ja )?trabalhou`,
    `(?:liste|mostre)(?: as)? (?:suas|as) empresas(?: em que ${YOU} trabalhou)?`,
    "quais (?:foram|sao) (?:os )?seus (?:empregadores|empregos anteriores)",
    "qual (?:e )?(?:o )?seu historico profissional"
  ],
  currentRole: [
    "qual (?:e )?(?:o )?seu cargo atual",
    "qual (?:e )?(?:a )?sua (?:funcao|posicao) atual",
    `onde ${YOU} trabalha(?: atualmente| hoje| agora)?`,
    `(?:em )?(?:qual|que) empresa ${YOU} trabalha(?: atualmente| hoje| agora)?`,
    `o que ${YOU} faz(?: atualmente| hoje| agora)?`,
    "qual (?:e )?(?:o )?seu (?:emprego|trabalho) atual"
  ],
  companyOverview: [
    `${TELL_PT} sobre (?:o )?(?:seu|sua) (?:trabalho|experiencia|funcao|cargo|passagem|tempo) ${PT_AT} {company}`,
    `${TELL_PT} sobre (?:a |o )?{company}`,
    `o que ${YOU} (?:fez|faz|fazia) ${PT_AT} {company}`
  ],
  companyRole: [
    `qual (?:e|era|foi) (?:o )?seu cargo ${PT_AT} {company}`,
    `qual (?:e|era|foi) (?:a )?sua (?:funcao|posicao) ${PT_AT} {company}`
  ],
  companyDates: [
    `quando ${YOU} trabalhou ${PT_AT} {company}`,
    `(?:em )?(?:qual|que) periodo ${YOU} trabalhou ${PT_AT} {company}`
  ],
  companyLocation: [
    `(?:em )?(?:qual|que) cidade ${YOU} trabalhou ${PT_AT} {company}`,
    `onde (?:era|ficava) (?:o )?seu (?:trabalho|cargo) ${PT_AT} {company}`,
    `qual (?:era|e) o local (?:do seu trabalho|de trabalho) ${PT_AT} {company}`
  ],
  technologies: [
    `quais tecnologias (?:estao )?(?:listadas )?no seu ${PT_CV}`,
    `(?:quais|que) (?:tecnologias|ferramentas) ${YOU} (?:ja )?(?:usou|utilizou)`,
    `com (?:quais|que) tecnologias ${YOU} (?:ja )?trabalhou`,
    "qual (?:e )?(?:a )?sua stack(?: tecnologica)?",
    "(?:liste|mostre) (?:as )?(?:suas )?tecnologias"
  ],
  technologyExperience: [
    `onde ${YOU} (?:ja )?(?:usou|utilizou|trabalhou com) {technology}`,
    `${YOU} (?:ja )?(?:usou|utilizou|trabalhou com) {technology}`,
    `${YOU} tem experiencia (?:com|em) {technology}`,
    `em (?:quais|que) (?:empresas|cargos) ${YOU} (?:usou|utilizou|trabalhou com) {technology}`
  ],
  companyTechnologies: [
    `(?:quais|que) tecnologias ${YOU} (?:usou|utilizou) ${PT_AT} {company}`,
    `com (?:quais|que) tecnologias ${YOU} trabalhou ${PT_AT} {company}`,
    `qual (?:era|e) (?:a )?sua stack ${PT_AT} {company}`
  ],
  technologyAtCompany: [
    `${YOU} (?:usou|utilizou|trabalhou com) {technology} ${PT_AT} {company}`
  ],
  posts: [
    `(?:quais|que) (?:artigos|posts|publicacoes) ${YOU} (?:ja )?(?:publicou|escreveu)`,
    "(?:liste|mostre) (?:os )?seus (?:artigos|posts)",
    "quais sao (?:os )?seus (?:artigos|posts)"
  ],
  postSearch: [
    `${YOU} tem (?:algum |alguns )?(?:artigos?|posts?) sobre {topic}`,
    `${YOU} (?:ja )?escreveu (?:algum |alguns )?(?:artigos? |posts? )?sobre {topic}`,
    "(?:quais|que) (?:artigos|posts) (?:falam|tratam|sao) (?:sobre|de) {topic}",
    "(?:mostre|liste) (?:os )?(?:seus )?(?:artigos|posts) sobre {topic}",
    "existem (?:artigos|posts) sobre {topic}"
  ],
  postSummary: [
    "(?:sobre o que|do que) (?:e|fala|trata) (?:o )?(?:seu )?(?:artigo|post) {title}",
    "(?:resuma|fale sobre) (?:o )?(?:seu )?(?:artigo|post) {title}",
    "o que diz (?:o )?(?:seu )?(?:artigo|post) {title}"
  ],
  hobbies: [
    "quais (?:sao )?(?:os )?seus (?:hobbies|passatempos)",
    `o que ${YOU} (?:faz|gosta de fazer) (?:no|em seu|no seu) tempo livre`,
    `${YOU} tem (?:algum |alguns )?(?:hobbies?|passatempos?)`
  ],
  socialLink: [
    "onde (?:posso|consigo|eu posso) (?:encontrar|achar|ver) (?:o )?seu (?:perfil )?(?:no |do |de )?{network}",
    "onde (?:eu )?encontro (?:o )?seu (?:perfil )?(?:no |do )?{network}",
    "qual (?:e )?(?:o )?seu {network}",
    "qual (?:e )?(?:o )?(?:link|endereco) do seu (?:perfil (?:no |do ))?{network}",
    "qual (?:e )?(?:o )?seu perfil (?:no|do) {network}",
    `${YOU} tem (?:perfil|conta) no {network}`,
    `${YOU} esta no {network}`
  ],
  socialLinks: [
    "quais sao (?:as )?suas redes sociais",
    "onde (?:posso|consigo) (?:te )?(?:encontrar|seguir) (?:online|na internet|nas redes sociais)",
    "(?:liste|mostre) (?:as )?suas redes sociais"
  ]
};

function compile(language: Locale, registry: Readonly<Record<IntentId, readonly string[]>>): QuestionPattern[] {
  const [prefix, suffix] = language === "en" ? [EN_PREFIX, EN_SUFFIX] : [PT_PREFIX, PT_SUFFIX];
  return (Object.keys(registry) as IntentId[]).flatMap(intent => registry[intent].map(body => ({
    intent,
    language,
    regex: new RegExp(`^${prefix}${body.replace(/\{(\w+)\}/g, (_, slot: SlotName) => SLOTS[slot])}${suffix}$`, "u")
  })));
}

export const QUESTION_PATTERNS: readonly QuestionPattern[] = Object.freeze([...compile("en", EN), ...compile("pt", PT)]);

/*
 * Follow-ups that refer to the experience the previous answer was about ("there", "that role").
 * They only resolve when the conversation has such a referent; "previous"/"next" move to the role
 * that started right before/after it. Tenure questions ("How long were you there?") stay unsupported.
 */
export type ContextRelation = "same" | "previous" | "next";

export interface ContextPattern {
  readonly intent: IntentId;
  readonly relation: ContextRelation;
  readonly language: Locale;
  readonly regex: RegExp;
}

type ContextRegistry = readonly (readonly [IntentId, ContextRelation, string])[];

const EN_CONTEXT: ContextRegistry = [
  ["companyOverview", "previous", "(?:and |what about |how about )?(?:before that|the (?:role|job) before(?: that)?)"],
  ["companyOverview", "next", "(?:and |what about |how about )?(?:after that|the (?:role|job) after(?: that)?)"],
  ["companyOverview", "same", "tell me more(?: about (?:it|that|that role|that job))?"],
  ["companyTechnologies", "same", "(?:and )?(?:which|what) (?:technologies|tools|tech) did you use there"],
  ["companyTechnologies", "same", "(?:and )?what (?:was|is) (?:your|the) (?:tech|technology) stack there"],
  ["companyRole", "same", "(?:and )?what (?:was|is) your (?:role|position|job title|title) there"],
  ["companyDates", "same", "(?:and )?when (?:was that|did you work there)"],
  ["companyLocation", "same", "(?:and )?where was that(?: role| job)?"]
];

const PT_CONTEXT: ContextRegistry = [
  ["companyOverview", "previous", "(?:e |e o |e o que veio )?antes(?: disso)?"],
  ["companyOverview", "next", "(?:e |e o |e o que veio )?depois(?: disso)?"],
  ["companyOverview", "same", "(?:me )?(?:fale|conte)(?:-me)? mais(?: sobre (?:isso|esse cargo|esse trabalho))?"],
  ["companyTechnologies", "same", `(?:e )?(?:quais|que) tecnologias ${YOU} (?:usou|utilizou) (?:la|ali)`],
  ["companyRole", "same", "(?:e )?qual (?:era|e|foi) (?:o )?seu cargo (?:la|ali)"],
  ["companyDates", "same", `(?:e )?quando (?:foi isso|${YOU} trabalhou (?:la|ali))`],
  ["companyLocation", "same", "(?:e )?onde (?:foi|era) isso"]
];

function compileContext(language: Locale, registry: ContextRegistry): ContextPattern[] {
  const [prefix, suffix] = language === "en" ? [EN_PREFIX, EN_SUFFIX] : [PT_PREFIX, PT_SUFFIX];
  return registry.map(([intent, relation, body]) => ({
    intent,
    relation,
    language,
    regex: new RegExp(`^${prefix}${body}${suffix}$`, "u")
  }));
}

export const CONTEXT_PATTERNS: readonly ContextPattern[] = Object.freeze([
  ...compileContext("en", EN_CONTEXT),
  ...compileContext("pt", PT_CONTEXT)
]);
