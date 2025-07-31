const calculateHotScore = (upvotes: number, downvotes: number, ageInHours: number): number => {
  // Reddit-style hot algorithm
  const score = upvotes - downvotes;
  const order = Math.log10(Math.max(Math.abs(score), 1));
  const sign = score > 0 ? 1 : score < 0 ? -1 : 0;
  const seconds = ageInHours * 3600;
  const epochSeconds = 1134028003; // Reddit epoch (Dec 8, 2005)
  
  return Math.round((sign * order + seconds / 45000) * 1000000) / 1000000;
};

const calculateControversyScore = (upvotes: number, downvotes: number): number => {
  // Controversy algorithm - higher when votes are close
  const total = upvotes + downvotes;
  if (total === 0) return 0;
  
  const magnitude = Math.pow(total, 0.5);
  const balance = upvotes > downvotes ? 
    downvotes / upvotes : 
    upvotes / downvotes;
  
  return magnitude * balance;
};

const calculateTrendingScore = (score: number, ageInHours: number, commentCount: number): number => {
  // Custom trending algorithm considering engagement velocity
  const baseScore = Math.max(score, 0);
  const commentBoost = Math.log10(commentCount + 1) * 2;
  const timeDecay = Math.pow(ageInHours + 2, -1.5);
  
  return (baseScore + commentBoost) * timeDecay;
};


export {calculateControversyScore,calculateHotScore,calculateTrendingScore}