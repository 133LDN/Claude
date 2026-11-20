// Heuristic vocabularies. These are this tool's detection aids, not published criteria.
// Every score effect they produce is tied to a confirmed tier 1 claim in rubric/rubric.json.

const w = (list) => new RegExp(`\\b(?:${list.join('|')})`, 'i');

export const PHIL = w([
  'philosoph', 'ethic', 'moral', 'epistem', 'metaphys', 'logic', 'utilitarian', 'deontolog', 'virtue',
  'normative', 'justice', 'fairness', 'rights?\\b', 'liberty', 'freedom', 'free will', 'argument', 'premise',
  'fallacy', 'paradox', 'thought experiment', 'veil of ignorance', 'maximin', 'is-ought', 'kant', 'mill\'?s?\\b',
  'rawls', 'nozick', 'hume', 'aristotle', 'plato', 'socrat', 'nussbaum', 'singer', 'parfit', 'popper', 'kuhn',
  'sandel', 'sen\\b', 'sen\'s', 'rational fools', 'theory of knowledge', 'tok\\b', 'falsifi', 'induction',
  'knowledge', 'truth', 'value judg', 'preferences? (?:deserve|ought)', 'ought', 'consequential', 'objection',
  'reconstruct an argument', 'egalitarian', 'libertarian', 'well-being', 'wellbeing', 'capabilit',
  'kierkegaard', 'gjentagelsen', 'nietzsche', 'hegel', 'sartre', 'camus', 'wittgenstein', 'locke', 'hobbes', 'rousseau', 'spinoza', 'descartes'
]);

export const ECON = w([
  'econom', 'market', 'price', 'pricing', 'supply', 'demand', 'inflation', 'monetary', 'fiscal', 'gdp', 'growth',
  'inequality', 'wage', 'labour', 'labor', 'employment', 'unemployment', 'utility', 'incentive', 'externalit',
  'game theory', 'prisoner\'?s dilemma', 'nash', 'equilibri', 'keynes', 'adam smith', 'friedman', 'piketty',
  'akerlof', 'kahneman', 'thaler', 'levitt', 'behavioural', 'behavioral', 'welfare', 'pareto', 'tax', 'tariff',
  'subsid', 'trade', 'interest rate', 'elasticit', 'marginal', 'cost', 'econometric', 'regression', 'identification',
  'comparison group', 'optimis', 'optimiz', 'model', 'firm', 'consumption', 'policy', 'money', 'financ', 'bank',
  'recession', 'productivity', 'minimum wage', 'defection', 'rational choice', 'self-interest', 'selfish agents',
  'freakonomics', 'the economist', 'brexit', 'eu\\b', 'european union', 'referend', 'austerity', 'bailout', 'sovereign debt',
  'aid\\b', 'nudge', 'choice theory', 'sunk.cost', 'government', 'moyo', 'dead aid', 'thaler', 'sunstein'
]);

// Terms that sit across the two subjects (philosophy of economics).
export const BRIDGE = w([
  'rational choice', 'rationality', 'self-interest', 'preferences? (?:deserve|ought)', 'welfare economics',
  'philosophy of economics', 'crowding out', 'crowd(?:s|ing)? out', 'realism of (?:its )?assumptions',
  'claim about the world or a tool', 'economic man', 'is defection really the rational'
]);

export const STUDY = w([
  'ib\\b', 'diploma', 'hl\\b', 'sl\\b', 'higher level', 'extended essay', 'internal assessment', 'theory of knowledge',
  'tok\\b', 'class', 'lesson', 'subject', 'studying', 'course', 'mathematics', 'maths', 'essay', 'commentar',
  'coursework', 'exam', 'teacher'
]);

export const ACADEMIC_MARKERS = w([
  'read', 'reading', 'essay', 'argu', 'theor', 'study', 'studied', 'studying', 'research', 'lecture', 'course',
  'online course', 'problem sets?', 'column', 'paper', 'journal', 'book', 'model', 'concept', 'idea', 'question',
  'evidence', 'data', 'estimate', 'debate on'
]);

export const EXTRACURRICULAR = w([
  'captain', 'team\\b', 'football', 'rugby', 'hockey', 'netball', 'basketball', 'tennis', 'swimming', 'gym',
  'orchestra', 'choir', 'piano', 'violin', 'guitar', 'band\\b', 'drama', 'theatre', 'volunteer', 'charity',
  'fundrais', 'bake sale', 'duke of edinburgh', 'dofe', 'part-time job', 'prefect', 'student council',
  'travelling', 'traveling', 'cooking', 'scouts?', 'intern(?:ing|ship|ed)?\\b', 'hobby', 'hobbies', 'work experience', 'shadowed', 'café', 'cafe'
]);

export const CAREER = /\b(?:career|careers|profession(?:al)? (?:goal|path)|become an? (?:economist|investment banker|banker|consultant|lawyer|analyst|policymaker|civil servant|trader|accountant)|work (?:in|at|for) (?:finance|banking|consulting|the city|government|the treasury|the imf|the world bank)|future job|my future (?:career|plans|job)|aspire to (?:be|become|work)|i (?:want|hope|plan|intend|aim) to (?:work|become|pursue))/i;

export const GRADES = /\b(?:predicted|grades?\b|\d{2} points|achieved (?:a )?(?:\d|top|high)|top grades|highest mark|high marks|a\*|mock exams?)/i;

export const REFLECTION = /\b(?:taught me|showed me|made me|led me|learn(?:ed|t)|realis|realiz|convinced me|persuaded me|which (?:taught|made|showed|helped|means)|because|so that|i now|question whether|sceptical|skeptical|curious about)/i;

export const OWN_VIEW = /\b(?:i (?:now )?(?:think|believe|argue|argued|would argue|suspect|doubt|accepted|was not convinced|am not convinced|am unconvinced|disagree|agree|concluded|came to think)|my (?:view|essay argued|answer)|in my view|persuaded me|convinced me|unsettled me|made me (?:question|more sceptical|doubt)|i defended|my objection)/i;

export const OBJECTION = /\b(?:however|but\b|yet\b|although|whereas|nonetheless|objection|objects?\b|counterexample|fails? to|cannot catch|overlook|assumes?\b|assumption|limitation|weakness|problem with|tension|contradict|undermin|falls? short|misdescrib|not convinced|unconvinced|sceptical|skeptical|question whether|harder to apply|needs more defence|rather than)/i;

export const REASON = /\b(?:because|since|so\b|therefore|which means|this suggests|it follows|only if|whenever|once\b|which (?:taught|made|showed)|depended on)/i;

export const DESCRIPTIVE = /\b(?:i found it (?:very )?interesting|very interesting|fascinat|passion|i enjoyed|opened my eyes|sparked my|introduced me|showed me that economics|which was about|helped me keep up)/i;

// Stock or AI-associated phrasing. Hard: almost never appears in strong human statements.
export const GENERIC_HARD = [
  'from a young age', 'ever since i was', 'i have always been fascinated', 'always been fascinated', 'deep passion',
  'passion for', 'passionate about', 'delve', 'tapestry', "in today's world", "in today's society", 'ever-evolving',
  'ever-changing', 'fast-paced world', 'multifaceted', 'a testament to', 'navigate the complexities',
  'the complexities of', 'plays a vital role', 'plays a crucial role', 'crucial for success', 'honed', 'invaluable',
  'embark', 'journey', 'well-rounded individual', 'shaped me into', 'would thrive', 'unwavering', 'my dream',
  'dream career', 'perfect first step', 'always dreamed', 'dreamed of', 'since i was young', 'i believe i am a hard-working', 'the world of', 'big questions'
];
// Soft: fine once, a tell in clusters.
export const GENERIC_SOFT = ['furthermore', 'moreover', 'in conclusion', 'additionally', 'very interesting', 'many skills', 'teamwork, leadership and communication'];

export const UNIVERSITIES = [
  { re: /\blondon school of economics\b/i, name: 'London School of Economics' },
  { re: /\bLSE\b/, name: 'LSE' },
  { re: /\bdurham\b/i, name: 'Durham', ambiguousPlace: true },
  { re: /\b(?<!duke of )edinburgh\b/i, name: 'Edinburgh', ambiguousPlace: true },
  { re: /\boxford\b/i, name: 'Oxford', ambiguousPlace: true },
  { re: /\bcambridge\b/i, name: 'Cambridge', ambiguousPlace: true },
  { re: /\bUCL\b|\buniversity college london\b/i, name: 'UCL' },
  { re: /\bwarwick\b/i, name: 'Warwick', ambiguousPlace: true },
  { re: /\bking'?s college\b/i, name: "King's College" },
  { re: /\bst\.? andrews\b/i, name: 'St Andrews', ambiguousPlace: true },
  { re: /\buniversity of [A-Z][a-z]+/, name: 'University of …' },
  { re: /\byour (?:university|department|course)\b/i, name: 'direct address to one university' }
];

// Strands of the programmes as taught (C-023, C-025, C-022).
export const STRANDS_MAIN = {
  'economic theory': /\b(?:micro|macro|supply|demand|market|incentive|price|equilibri|game theory|marginal|wage|employment|inflation|behavioural|behavioral|nudge|choice theory|sunk.cost|austerity)/i,
  'quantitative methods': /\b(?:econometric|statistic|regression|data|mathematic|maths|optimis|optimiz|estimate|identification|comparison group|formal model)/i,
  'logic and argument': /\b(?:logic|argument|reconstruct|premise|fallacy|valid)/i,
  'ethics and value': /\b(?:ethic|moral|justice|fair|utilitarian|rawls|veil of ignorance|maximin|ought|deserve|well-being|welfare)/i,
  'philosophy of economics or science': /\b(?:realism of|assumptions|popper|falsifi|claim about the world|tool for thinking|economic man|rational fools|philosophy of (?:economics|science)|is an economic model|science)/i
};
export const STRANDS_DURHAM = {
  'microeconomic theory': /\b(?:micro|supply|demand|market|incentive|price|game theory|marginal|firm|elasticit)/i,
  'macroeconomics': /\b(?:macro|inflation|interest rate|gdp|growth|recession|unemployment|monetary|fiscal)/i,
  'data and quantitative methods': /\b(?:econometric|statistic|regression|data|mathematic|maths|optimis|estimate|identification)/i,
  'applied policy': /\b(?:policy|tax|subsid|minimum wage|regulat|tariff)/i
};

export const WORK_CLAIM = /\b(?:argues?|argued|claims?|claimed|shows?|showed|proposes?|wrote|suggests?|according to|in (?:his|her|their) (?:book|essay|paper)|which (?:was about|argues|showed|claims))\b/i;
export const NAMED_WORK_OR_AUTHOR = /(?:\b(?:Kierkegaard|Moyo|Thaler|Sunstein|Nietzsche|Hegel|Sartre|Camus|Wittgenstein|Locke|Hobbes|Rousseau|Madhavan)\b|\b[A-Z][a-z]+(?:’|')s [A-Z][a-zæøå]+|\b(?:[Hh]aving read|[Rr]eading|I read) [A-Z][a-z]+|"[^"]{3,80}"|\b(?:Friedman|Sen|Sandel|Rawls|Mill|Kant|Hume|Popper|Kahneman|Levitt|Dubner|Smith|Keynes|Piketty|Hayek|Marx|Nozick|Parfit|Singer|Nussbaum|Akerlof|Thaler|Arrow|Hausman)\b|\b[A-Z][a-z]+(?:,? [A-Z][a-z]+){1,4}\b by [A-Z])/;

// Names of IB subjects; three or more in one sentence reads as a list of qualifications (C-031).
export const IB_SUBJECTS = /\b(?:History|English|Economics|Mathematics|Maths|Physics|Chemistry|Biology|Philosophy|Geography|French|Spanish|German|Italian|Mandarin|Business(?: and Management)?|Psychology|Computer Science|Literature|Global Politics|Visual Arts|Music)\b/g;

// Concrete work: the applicant did something specific (built, measured, estimated, wrote, tested ...).
// Used to stop style deductions outweighing substance (C-034).
export const CONCRETE = /\b(?:built|build|measured|tested|coded|programmed|designed|estimated|reproduced|calculated|derived|simulated|modelled|modeled|collected|surveyed|interviewed|analysed|analyzed|compared|tuned|prototyp|debugg|soldered|wrote (?:a|an|my|up)|ran (?:a|an|my)|my extended essay|my essay argued|completed an? (?:online )?course|problem sets?)\b/i;
