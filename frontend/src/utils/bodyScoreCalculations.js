// ============================= 
// Pure helper functions for Body Score calculations
// ============================= 

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const linmap = (x, inMin, inMax, outMin, outMax) => outMin + (outMax - outMin) * ((x - inMin) / (inMax - inMin));

// Map raw VO₂max ml/kg/min to 0..100 where 20 → 0 and 90 → 100
export const mapVo2RawToScore = (v) => {
  if (v == null || isNaN(Number(v))) return null;
  const min = 20, max = 90;
  const clamped = clamp(Number(v), min, max);
  const t = (clamped - min) / (max - min);
  return Math.round(t * 100);
};

// ---- VO₂max norms by age band and sex (ml/kg/min) ----
const VO2_NORMS = {
  male: [
    { min: 20, max: 29, mean: 45, sd: 7 },
    { min: 30, max: 39, mean: 43, sd: 7 },
    { min: 40, max: 49, mean: 41, sd: 7 },
    { min: 50, max: 59, mean: 39, sd: 7 },
    { min: 60, max: 69, mean: 36, sd: 7 },
    { min: 70, max: 120, mean: 34, sd: 7 },
  ],
  female: [
    { min: 20, max: 29, mean: 38, sd: 6 },
    { min: 30, max: 39, mean: 36, sd: 6 },
    { min: 40, max: 49, mean: 34, sd: 6 },
    { min: 50, max: 59, mean: 32, sd: 6 },
    { min: 60, max: 69, mean: 30, sd: 6 },
    { min: 70, max: 120, mean: 28, sd: 6 },
  ],
};

// Error function + Normal CDF for percentile conversion
const erf = (x) => {
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const sign = x < 0 ? -1 : 1;
  x=Math.abs(x);
  const t = 1/(1+p*x);
  const y = 1 - (((((a5*t+a4)*t+a3)*t+a2)*t+a1)*t*Math.exp(-x*x));
  return sign*y;
};
const normalCdf = (x) => 0.5 * (1 + erf(x / Math.SQRT2));

// Band for age helper
const bandForAge = (bands, age) => bands.find(b => age >= b.min && age <= b.max) || bands[bands.length - 1];

export const vo2PercentileFromRaw = (age, sex, vo2raw) => {
  if (age == null || vo2raw == null || isNaN(Number(age)) || isNaN(Number(vo2raw))) return null;
  const a = Number(age);
  const raw = Number(vo2raw);

  let mean, sd;
  if (sex === 'male' || sex === 'female') {
    const band = bandForAge(VO2_NORMS[sex], a);
    mean = band.mean;
    sd = band.sd;
  } else {
    const m = bandForAge(VO2_NORMS.male, a);
    const f = bandForAge(VO2_NORMS.female, a);
    mean = (m.mean + f.mean) / 2;
    sd = (m.sd + f.sd) / 2;
  }

  const z = (raw - mean) / sd;
  const p = normalCdf(z) * 100;
  return clamp(Math.round(p), 0, 100);
};

export const compressPercentile = (p, factor = 0.85) => {
  if (p == null || isNaN(Number(p))) return null;
  const base = clamp(Number(p), 0, 100);
  return Math.round(50 + (base - 50) * factor);
};

export const vo2AgeSexAdjustedScore = (age, sex, vo2raw, factor = 0.85) => {
  const perc = vo2PercentileFromRaw(age, sex, vo2raw);
  if (perc == null) return null;
  // High-end rule: elite values shouldn't be penalized by compression.
  // If raw ≥ 90 ml/kg/min OR percentile ≥ 98th, grant full score.
  if (vo2raw != null && !isNaN(Number(vo2raw)) && Number(vo2raw) >= 90) return 100;
  if (perc >= 98) return 100;
  return compressPercentile(perc, factor);
};

// HRV: z-score (cap [-2,2]) → 0..100
export const hrvZToScore = (z) => {
  if (z == null || isNaN(Number(z))) return null;
  const zc = clamp(Number(z), -2, 2);
  return clamp(Math.round(50 + 25 * zc), 0, 100);
};

// RHR simple map: 40 bpm => 100, 80 bpm => 0
export const rhrSimpleToScore = (bpm) => {
  if (bpm == null || isNaN(Number(bpm))) return null;
  const min = 40, max = 80;
  const clamped = clamp(Number(bpm), min, max);
  const t = (clamped - min) / (max - min);
  return Math.round(100 * (1 - t));
};

// ACWR: 0.8–1.3 => 100; decay to 0 at ≤0.5 or ≥1.8
export const acwrToScore = (x) => {
  if (x == null || isNaN(Number(x))) return null;
  x = Number(x);
  if (x >= 0.8 && x <= 1.3) return 100;
  if (x <= 0.5 || x >= 1.8) return 0;
  if (x < 0.8) return Math.round(((x - 0.5) / 0.3) * 100);
  // x in (1.3..1.8)
  return Math.round(((1.8 - x) / 0.5) * 100);
};

// TSB: |TSB| ≤ 10 => 100; decay to 0 by |TSB| ≥ 40
export const tsbToScore = (v) => {
  if (v == null || isNaN(Number(v))) return null;
  const a = Math.abs(Number(v));
  if (a <= 10) return 100;
  if (a >= 40) return 0;
  return Math.round(100 - ((a - 10) * (100 / 30)));
};

// Body Age delta (Chron − BodyAge), map [-10,+10] years → [0,100] around 50
export const bodyAgeToScore = (chronAge, bodyAge) => {
  if (chronAge == null || bodyAge == null || isNaN(Number(chronAge)) || isNaN(Number(bodyAge))) return null;
  const delta = Number(chronAge) - Number(bodyAge); // positive good
  return clamp(Math.round(50 + 5 * delta), 0, 100);
};

// BMI centered at 22.5 with quadratic penalty
export const bmiToScore = (bmi) => {
  if (bmi == null || isNaN(Number(bmi))) return null;
  const penalty = 2 * Math.pow(Number(bmi) - 22.5, 2);
  return clamp(Math.round(100 - penalty), 0, 100);
};

// Body Fat % (sex-aware). male: 10–18% mid 14; female: 18–26% mid 22; other: 14–22 mid 18
export const bodyFatToScore = (pct, sex) => {
  if (pct == null || isNaN(Number(pct))) return null;
  let low = 14, high = 22, mid = 18, softness = 1.2; // default
  if (sex === "male") {
    low = 10; high = 18; mid = 14; softness = 1.4;
  } else if (sex === "female") {
    low = 18; high = 26; mid = 22; softness = 1.4;
  }
  pct = Number(pct);
  if (pct >= low && pct <= high) return 100;
  const penalty = softness * Math.pow(pct - mid, 2);
  return clamp(Math.round(100 - penalty), 0, 100);
};

// Heart Rate Reserve → score by HRR% of MaxHR (35% → 0, 60% → 100)
export const hrrToScore = (hrrPct) => {
  if (hrrPct == null || isNaN(Number(hrrPct))) return null;
  const min = 35, max = 60;
  const clamped = clamp(Number(hrrPct), min, max);
  return Math.round(((clamped - min) / (max - min)) * 100);
};

// Helper to convert value to number
export const toNum = (v) => (v === "" || v === null || isNaN(Number(v)) ? null : Number(v));

/**
 * Calculate the overall body score from health metrics
 * @param {Object} data - Health metrics data from backend
 * @returns {Object} - Total score and component breakdown
 */
export const calculateBodyScore = (data) => {
  const age = toNum(data.age);
  const gender = data.gender;
  const heightCm = toNum(data.height_cm);
  const weightKg = toNum(data.weight_kg);
  const bodyFatPct = toNum(data.body_fat_percentage);
  
  // VO2max - use any available source
  const vo2Raw = toNum(data.vo2_max_strava) || toNum(data.vo2_max_garmin) || 
                 toNum(data.vo2_max_polar) || toNum(data.vo2_max_manual);
  
  // HRV
  const hrv7d = toNum(data.hrv_7d_avg);
  const hrvMean = toNum(data.hrv_baseline_mean);
  const hrvSd = toNum(data.hrv_baseline_sd);
  
  // RHR
  const rhrBpm = toNum(data.resting_heart_rate);
  
  // Load/Fatigue
  const acwr = toNum(data.acwr);
  
  // Oura scores
  const ouraSleep = toNum(data.oura_sleep_score);
  const ouraReadiness = toNum(data.oura_readiness_score);
  const ouraBodyAge = toNum(data.oura_body_age);
  
  // Max HR
  const maxHrInput = toNum(data.max_heart_rate_manual);
  const estMaxHr = age ? Math.round(208 - 0.7 * age) : null;
  const maxHrUsed = maxHrInput ?? estMaxHr;
  
  // Calculate BMI
  const bmi = (heightCm && weightKg && heightCm > 0) ? weightKg / Math.pow(heightCm / 100, 2) : null;
  
  // Calculate sub-scores
  const vo2_score = age && gender && vo2Raw ? vo2AgeSexAdjustedScore(age, gender, vo2Raw) : null;
  
  let hrv_score = null;
  if (hrvMean != null && hrvSd != null && hrvSd > 0 && hrv7d != null) {
    const z = (hrv7d - hrvMean) / hrvSd;
    hrv_score = hrvZToScore(z);
  }
  
  const rhr_score = rhrBpm != null ? rhrSimpleToScore(rhrBpm) : null;
  
  let hrr_score = null;
  if (rhrBpm != null && maxHrUsed != null && maxHrUsed > rhrBpm) {
    const hrr = maxHrUsed - rhrBpm;
    const hrrPct = (hrr / maxHrUsed) * 100;
    hrr_score = hrrToScore(hrrPct);
  }
  
  const fatigue_score = acwr != null ? acwrToScore(acwr) : null;
  const sleep_score = ouraSleep != null ? clamp(Math.round(ouraSleep), 0, 100) : null;
  const readiness_score = ouraReadiness != null ? clamp(Math.round(ouraReadiness), 0, 100) : null;
  const bodyage_score = (age != null && ouraBodyAge != null) ? bodyAgeToScore(age, ouraBodyAge) : null;
  const bmi_score = bmiToScore(bmi);
  const bodyfat_score = (bodyFatPct != null && gender) ? bodyFatToScore(bodyFatPct, gender) : null;
  const bodycomp_score = bodyfat_score ?? bmi_score ?? null;
  
  // Base weights
  const baseWeights = {
    vo2: 24,
    hrv: 14,
    rhr: 9,
    hrr: 5,
    fatigue: 14,
    sleep: 10,
    readiness: 10,
    bodyAge: 10,
    bodyComp: 10,
  };
  
  // Build parts array
  const parts = [
    { key: "vo2", label: "VO₂max", weight: baseWeights.vo2, score: vo2_score },
    { key: "hrv", label: "HRV", weight: baseWeights.hrv, score: hrv_score },
    { key: "rhr", label: "Resting HR", weight: baseWeights.rhr, score: rhr_score },
    { key: "hrr", label: "Heart Rate Reserve", weight: baseWeights.hrr, score: hrr_score },
    { key: "fatigue", label: "Load Balance (ACWR)", weight: baseWeights.fatigue, score: fatigue_score },
    { key: "sleep", label: "Oura Sleep", weight: baseWeights.sleep, score: sleep_score },
    { key: "readiness", label: "Oura Readiness", weight: baseWeights.readiness, score: readiness_score },
    { key: "bodyAge", label: "Body Age delta", weight: baseWeights.bodyAge, score: bodyage_score },
    { 
      key: "bodyComp", 
      label: bodyfat_score != null ? "Body Fat %" : (bmi_score != null ? "BMI" : "Body Composition"), 
      weight: baseWeights.bodyComp, 
      score: bodycomp_score 
    },
  ];
  
  // Filter available and normalize weights
  const available = parts.filter(p => p.score != null);
  const weightSum = available.reduce((s, p) => s + p.weight, 0);
  const normalized = available.map(p => ({ 
    ...p, 
    nWeight: (p.weight / weightSum) * 100 
  }));
  
  // Calculate total score
  const totalScore = weightSum > 0 ? Math.round(normalized.reduce((sum, p) => sum + (p.score * p.nWeight) / 100, 0)) : 0;
  
  // Calculate drivers and drags
  const sortedByContribution = [...normalized]
    .map(p => ({ ...p, contribution: (p.score - 50) * (p.nWeight / 100) }))
    .sort((a, b) => b.contribution - a.contribution);
  
  const drivers = sortedByContribution.filter(p => p.contribution > 0).slice(0, 2);
  const drags = sortedByContribution.filter(p => p.contribution < 0).slice(0, 2);
  
  return {
    totalScore,
    components: normalized,
    drivers,
    drags,
    available: available.length,
    total: parts.length
  };
};
