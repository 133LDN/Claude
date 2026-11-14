// Illustrations of a technique on a deliberately unrelated topic.
// Rules (CLAUDE.md): at most 2 sentences, never about the applicant's subjects, always labelled "not for use".
const ex = (topic, text) => ({ label: 'not for use', topic, text });

export const EXAMPLES = {
  'C-005': ex('marine biology', 'Carson\'s account of DDT in food chains convinced me at first. I now doubt it applies to deep-sea fish, because their diet links are too short for the build-up she describes.'),
  'C-016': ex('architecture', 'Reading Jacobs on city streets made me notice that the busiest pavements near my home are the ones with the most doorways.'),
  'C-012': ex('music', 'Accompanying a choir taught me to listen to the weakest voice first, which is now how I check a chord before I play it.'),
  'C-015': ex('astronomy', 'Instead of naming five observing nights, describe the one night the star chart was wrong and what you did about it.'),
  'C-014': ex('cooking', 'Compare "my passion for cooking" with "I burned the roux three times before I learned to keep the heat low."')
};
