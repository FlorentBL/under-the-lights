export type EditorialTone = "dramatic" | "analytical" | "discovery";

export type EditorialCandidate = {
  homeName: string;
  awayName: string;
  competitionName: string;
  homePosition: number | null;
  awayPosition: number | null;
  homePoints: number | null;
  awayPoints: number | null;
  homeRecord: string | null;
  awayRecord: string | null;
  homeManager: string | null;
  awayManager: string | null;
  homeStrength: number | null;
  awayStrength: number | null;
  reasons: string[];
};

export type EditorialDraft = {
  title: string;
  summary: string;
};

type RecordLine = { won: number; drawn: number; lost: number; played: number };

const numberWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

function parseRecord(value: string | null): RecordLine | null {
  const match = value?.match(/^(\d+)-(\d+)-(\d+)$/);
  if (!match) return null;
  const [won, drawn, lost] = match.slice(1).map(Number);
  return { won, drawn, lost, played: won + drawn + lost };
}

function word(value: number) {
  return numberWords[value] || String(value);
}

function capitalise(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function clip(value: string, maximum: number) {
  if (value.length <= maximum) return value;
  const shortened = value.slice(0, maximum - 1);
  return `${shortened.slice(0, shortened.lastIndexOf(" "))}.`;
}

function standingsLine(candidate: EditorialCandidate) {
  if (candidate.homePosition === 1 && candidate.awayPosition === 2) {
    return `Leaders ${candidate.homeName} welcome second-placed ${candidate.awayName}`;
  }
  if (candidate.homePosition === 2 && candidate.awayPosition === 1) {
    return `Second-placed ${candidate.homeName} host leaders ${candidate.awayName}`;
  }
  if (candidate.homePosition && candidate.awayPosition) {
    return `${candidate.homeName} sit ${candidate.homePosition}, with ${candidate.awayName} in ${candidate.awayPosition}`;
  }
  return `${candidate.homeName} meet ${candidate.awayName}`;
}

function buildFacts(candidate: EditorialCandidate) {
  const homeRecord = parseRecord(candidate.homeRecord);
  const awayRecord = parseRecord(candidate.awayRecord);
  const levelOnPoints = candidate.homePoints !== null && candidate.homePoints === candidate.awayPoints;
  const topTwo = candidate.homePosition !== null && candidate.awayPosition !== null
    && Math.max(candidate.homePosition, candidate.awayPosition) <= 2;
  const matchingRecords = Boolean(candidate.homeRecord && candidate.homeRecord === candidate.awayRecord);
  const perfectStarts = Boolean(
    homeRecord && awayRecord
    && homeRecord.played > 0
    && homeRecord.played === awayRecord.played
    && homeRecord.won === homeRecord.played
    && awayRecord.won === awayRecord.played,
  );
  const equalStrength = candidate.homeStrength !== null && candidate.awayStrength !== null
    && Math.abs(candidate.homeStrength - candidate.awayStrength) < 0.05;
  const closeStrength = candidate.homeStrength !== null && candidate.awayStrength !== null
    && Math.abs(candidate.homeStrength - candidate.awayStrength) < 1;
  const activeManagers = Boolean(candidate.homeManager && candidate.awayManager);
  const discoveryPick = candidate.reasons.some((reason) => reason === "Discovery pick" || reason === "Lower-division spotlight");

  return {
    homeRecord,
    awayRecord,
    levelOnPoints,
    topTwo,
    matchingRecords,
    perfectStarts,
    equalStrength,
    closeStrength,
    activeManagers,
    discoveryPick,
  };
}

function dramaticDraft(candidate: EditorialCandidate, variation: number): EditorialDraft {
  const facts = buildFacts(candidate);
  const endings = [
    "One perfect start has to give way under the lights.",
    "The table calls it a title race. The numbers call it too close to split.",
    "Something has to separate them when the spotlight comes on.",
  ];
  const topTwoTitles = [
    "Perfect starts. One spotlight.",
    "First against second. Nothing between them.",
    "Two perfect records. One defining night.",
  ];

  if (facts.perfectStarts && facts.homeRecord) {
    const maximumPoints = facts.homeRecord.played * 3;
    const opening = `${capitalise(word(maximumPoints))} points from ${word(maximumPoints)}.`;
    const strength = facts.equalStrength && candidate.homeStrength !== null
      ? `Even their squad ratings are identical at ${candidate.homeStrength.toFixed(1)}.`
      : facts.closeStrength
        ? "Even the squad ratings leave almost nothing between them."
        : "Both arrive with a perfect record.";
    return {
      title: topTwoTitles[variation % topTwoTitles.length],
      summary: clip(`${opening} ${standingsLine(candidate)} after matching starts to the season. ${strength} ${endings[variation % endings.length]}`, 360),
    };
  }

  const opening = facts.topTwo ? "First against second." : facts.levelOnPoints ? "Level on points." : "One match owns the weekend.";
  const evidence = facts.matchingRecords && candidate.homeRecord
    ? `Both carry ${candidate.homeRecord} records.`
    : facts.closeStrength
      ? "The squad ratings leave almost nothing between them."
      : "The radar found two sides with everything to play for.";
  return {
    title: facts.topTwo ? topTwoTitles[variation % topTwoTitles.length] : `${candidate.homeName} vs ${candidate.awayName}: under the lights`,
    summary: clip(`${opening} ${standingsLine(candidate)} this weekend. ${evidence} ${endings[variation % endings.length]}`, 360),
  };
}

function analyticalDraft(candidate: EditorialCandidate, variation: number): EditorialDraft {
  const facts = buildFacts(candidate);
  const titles = facts.equalStrength && facts.levelOnPoints
    ? ["Level on points. Level in strength.", "No statistical favourite.", "The numbers refuse to choose."]
    : ["The numbers behind the matchup", "A contest measured in fine margins", "The closest call of the weekend"];
  const sentences: string[] = [];

  sentences.push(facts.equalStrength && facts.levelOnPoints ? "The numbers leave no clear favourite." : `${standingsLine(candidate)}.`);
  if (facts.levelOnPoints && candidate.homePoints !== null) sentences.push(`The teams are level on ${candidate.homePoints} points.`);
  if (facts.matchingRecords && candidate.homeRecord) sentences.push(`Both own ${candidate.homeRecord} records.`);
  if (facts.equalStrength && candidate.homeStrength !== null) sentences.push(`Their squad ratings are tied at ${candidate.homeStrength.toFixed(1)}.`);
  else if (facts.closeStrength && candidate.homeStrength !== null && candidate.awayStrength !== null) {
    sentences.push(`The squad ratings read ${candidate.homeStrength.toFixed(1)} and ${candidate.awayStrength.toFixed(1)}.`);
  }
  if (facts.topTwo) sentences.push("First meets second with no obvious edge.");
  else if (facts.activeManagers) sentences.push("Two active managers now decide where the advantage lies.");

  const rotated = variation % 2 === 0 ? sentences : [sentences[0], ...sentences.slice(1).reverse()];
  return { title: titles[variation % titles.length], summary: clip(rotated.join(" "), 360) };
}

function discoveryDraft(candidate: EditorialCandidate, variation: number): EditorialDraft {
  const facts = buildFacts(candidate);
  const titles = facts.topTwo
    ? [`A hidden top-two clash in ${candidate.competitionName}`, `${candidate.competitionName} takes the stage`, "The title race beyond the headlines"]
    : [`${candidate.competitionName} takes the stage`, "The weekend match worth finding", "Beyond the familiar leagues"];
  const opening = facts.discoveryPick
    ? `Away from the headline leagues, ${candidate.competitionName} delivers ${facts.topTwo ? "a top-two meeting" : "a matchup worth finding"}.`
    : `${candidate.competitionName} brings ${candidate.homeName} and ${candidate.awayName} into the spotlight.`;
  const evidence: string[] = [];

  if (facts.levelOnPoints && candidate.homePoints !== null) evidence.push(`They are level on ${candidate.homePoints} points`);
  if (facts.matchingRecords && candidate.homeRecord) evidence.push(`share ${candidate.homeRecord} records`);
  if (facts.activeManagers) evidence.push("are led by active managers");
  const middle = evidence.length ? `${capitalise(evidence.join(", "))}.` : `${standingsLine(candidate)}.`;
  const endings = [
    "This is exactly the kind of fixture the radar was built to find.",
    "For one weekend, their corner of the football world becomes the main stage.",
    "The spotlight moves beyond the usual names and lands here.",
  ];

  return {
    title: clip(titles[variation % titles.length], 120),
    summary: clip(`${opening} ${middle} ${endings[variation % endings.length]}`, 360),
  };
}

export function buildEditorialDraft(candidate: EditorialCandidate, tone: EditorialTone, variation = 0): EditorialDraft {
  if (tone === "analytical") return analyticalDraft(candidate, variation);
  if (tone === "discovery") return discoveryDraft(candidate, variation);
  return dramaticDraft(candidate, variation);
}
